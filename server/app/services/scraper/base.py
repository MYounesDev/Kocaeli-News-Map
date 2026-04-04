"""
Base scraper abstract class.

All news site scrapers inherit from this and implement the scrape() method.
"""

import asyncio
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
}


@dataclass
class RawArticle:
    """Raw scraped article data before processing."""
    title: str
    content: str  # Raw HTML or text content
    category: str  # Category from the source
    published_at: datetime
    source_name: str
    source_url: str
    content_html: str = ""  # Full article page HTML (for content extraction)


class BaseScraper(ABC):
    """Abstract base class for news site scrapers."""

    def __init__(self):
        self.settings = get_settings()
        self.delay = self.settings.REQUEST_DELAY
        self.concurrency = self.settings.SCRAPE_CONCURRENCY

    @property
    @abstractmethod
    def source_name(self) -> str:
        """The name identifier for this news source."""
        ...

    @property
    @abstractmethod
    def base_url(self) -> str:
        """The base URL of the news site."""
        ...

    @abstractmethod
    async def scrape(self, days: int = 3) -> list[RawArticle]:
        """
        Scrape articles from the last N days.

        Args:
            days: Number of days to scrape (default 3)

        Returns:
            List of RawArticle objects
        """
        ...

    async def fetch_page(self, client: httpx.AsyncClient, url: str) -> Optional[str]:
        """
        Fetch an HTML page with error handling and rate limiting.

        Args:
            client: httpx.AsyncClient instance
            url: URL to fetch

        Returns:
            HTML content as string, or None on failure
        """
        try:
            await asyncio.sleep(self.delay)
            response = await client.get(url, headers=HEADERS, follow_redirects=True)
            response.raise_for_status()
            return response.text
        except httpx.HTTPStatusError as e:
            logger.warning(f"HTTP {e.response.status_code} for {url}")
            return None
        except httpx.RequestError as e:
            logger.warning(f"Request error for {url}: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error fetching {url}: {e}")
            return None

    async def fetch_pages_concurrent(
        self,
        client: httpx.AsyncClient,
        urls: list[str],
        max_concurrent: int | None = None,
    ) -> list[Optional[str]]:
        """
        Fetch multiple pages concurrently with bounded parallelism.

        Args:
            client: httpx.AsyncClient instance
            urls: List of URLs to fetch
            max_concurrent: Maximum number of concurrent requests (default: self.concurrency)

        Returns:
            List of HTML strings (or None for failed requests), in the same order as urls.
        """
        if not urls:
            return []

        limit = max_concurrent or self.concurrency
        semaphore = asyncio.Semaphore(limit)

        async def _fetch_one(url: str) -> Optional[str]:
            async with semaphore:
                return await self.fetch_page(client, url)

        results = await asyncio.gather(*[_fetch_one(url) for url in urls])
        return list(results)

    def get_client(self) -> httpx.AsyncClient:
        """Create a configured httpx async client."""
        return httpx.AsyncClient(
            timeout=httpx.Timeout(30.0, connect=10.0),
            follow_redirects=True,
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
        )
