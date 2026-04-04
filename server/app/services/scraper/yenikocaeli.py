"""
Scraper for yenikocaeli.com

Different structure from the other sources:
- Category-based pages: /haber/{category}/sayfa-{page}.html
- Articles are in div.col-sm-12.col-md-6.col-lg-4 blocks
- Date is extracted from individual article pages using date_parser

Optimized: fetches article pages concurrently within each category page.
"""

import logging
import re
from datetime import datetime, timedelta

from bs4 import BeautifulSoup

from app.services.preprocessor import extract_article_content
from app.services.scraper.base import BaseScraper, RawArticle
from app.utils.date_parser import extract_publish_date, try_parse

logger = logging.getLogger(__name__)

# Category URL slugs for yenikocaeli.com
YENI_CATEGORIES = {
    "guncel": "guncel",
    "polis": "polis-adliye",
    "siyaset": "siyaset",
    "egitim": "egitim",
    "ekonomi": "ekonomi",
    "yasam": "yasam",
    "saglik": "saglik",
    "teknoloji": "teknoloji",
    "spor": "spor",
}


class YeniKocaeliScraper(BaseScraper):
    """Scraper for Yeni Kocaeli news site."""

    @property
    def source_name(self) -> str:
        return "yenikocaeli"

    @property
    def base_url(self) -> str:
        return "https://www.yenikocaeli.com"

    async def scrape(self, days: int = 3) -> list[RawArticle]:
        """Scrape articles from the last N days across all categories."""
        articles = []
        cutoff_date = datetime.now() - timedelta(days=days)

        async with self.get_client() as client:
            for category_key, category_slug in YENI_CATEGORIES.items():
                logger.info(f"[{self.source_name}] Scraping category: {category_key}")
                category_articles = await self._scrape_category(
                    client, category_key, category_slug, cutoff_date
                )
                articles.extend(category_articles)
                logger.info(
                    f"[{self.source_name}] {category_key}: {len(category_articles)} articles"
                )

        logger.info(f"[{self.source_name}] Total: {len(articles)} articles scraped")
        return articles

    async def _scrape_category(
        self, client, category_key: str, category_slug: str, cutoff_date: datetime
    ) -> list[RawArticle]:
        """Scrape all pages of a single category until cutoff date."""
        articles = []
        page = 1
        max_pages = 10  # Safety limit

        while page <= max_pages:
            page_url = f"{self.base_url}/haber/{category_slug}/sayfa-{page}.html"
            logger.info(f"[{self.source_name}] Fetching page: {page_url}")

            html = await self.fetch_page(client, page_url)
            if not html:
                break

            page_articles, should_continue = await self._parse_category_page(
                client, html, category_key, cutoff_date
            )
            articles.extend(page_articles)

            if not should_continue or not page_articles:
                break

            page += 1

        return articles

    async def _parse_category_page(
        self, client, html: str, category_key: str, cutoff_date: datetime
    ) -> tuple[list[RawArticle], bool]:
        """
        Parse a category listing page and fetch article details concurrently.

        Returns:
            Tuple of (articles, should_continue_pagination)
        """
        soup = BeautifulSoup(html, "lxml")
        articles = []
        should_continue = True

        # Find article cards
        cards = soup.find_all("div", class_="col-sm-12 col-md-6 col-lg-4")

        if not cards:
            return articles, False

        # ── Step 1: Extract card metadata (title, link, summary) ──
        card_entries = []
        for card in cards:
            title_tag = card.find("h4", class_="post-title")
            if not title_tag:
                continue
            link_tag = title_tag.find("a", href=True)
            if not link_tag:
                continue

            href = link_tag["href"]
            title = link_tag.get_text(strip=True)

            summary_tag = card.find("p", class_="post-text")
            summary = ""
            if summary_tag:
                summary_link = summary_tag.find("a")
                if summary_link:
                    summary = summary_link.get_text(strip=True)

            if href.startswith("http"):
                full_url = href
            elif href.startswith("/"):
                full_url = f"{self.base_url}{href}"
            else:
                full_url = f"{self.base_url}/{href}"

            card_entries.append({
                "title": title,
                "summary": summary,
                "url": full_url,
            })

        if not card_entries:
            return articles, False

        # ── Step 2: Fetch all article pages concurrently ──
        urls = [entry["url"] for entry in card_entries]
        html_pages = await self.fetch_pages_concurrent(client, urls)

        # ── Step 3: Process fetched pages (date extraction, content) ──
        consecutive_old = 0

        for entry, article_html in zip(card_entries, html_pages):
            if not article_html:
                continue

            # Extract publish date — use site-specific parser FIRST (most reliable),
            # then fall back to the generic parser
            publish_date = self._extract_date_from_clock(article_html)

            if not publish_date:
                publish_date = extract_publish_date(article_html, entry["url"])

            logger.info(
                f"[{self.source_name}] Article: {entry['url']} → date: {publish_date}"
            )

            if not publish_date:
                logger.warning(f"[{self.source_name}] No date found, skipping: {entry['url']}")
                continue

            # Check if article is within the requested time range
            if publish_date < cutoff_date:
                consecutive_old += 1
                logger.info(
                    f"[{self.source_name}] Article too old ({publish_date.strftime('%Y-%m-%d %H:%M')}), "
                    f"cutoff is {cutoff_date.strftime('%Y-%m-%d %H:%M')} "
                    f"(consecutive old: {consecutive_old})"
                )
                if consecutive_old >= 3:
                    should_continue = False
                    logger.info(
                        f"[{self.source_name}] Stopping category {category_key}: "
                        f"{consecutive_old} consecutive articles older than cutoff"
                    )
                    break
                continue

            # Reset counter when we find a recent article
            consecutive_old = 0

            # Extract full content
            content = extract_article_content(article_html)

            combined_title = entry["title"]
            if entry["summary"] and entry["summary"] not in entry["title"]:
                combined_title = f"{entry['title']} - {entry['summary']}"

            articles.append(RawArticle(
                title=combined_title,
                content=content,
                category=category_key,
                published_at=publish_date,
                source_name=self.source_name,
                source_url=entry["url"],
                content_html=article_html,
            ))

        return articles, should_continue

    @staticmethod
    def _extract_date_from_clock(html: str):
        """
        Parse the <span class="clock"> element on yenikocaeli article pages.

        Expected format:  02 Nisan 2026  16:38
        """
        soup = BeautifulSoup(html, "lxml")
        clock_span = soup.find("span", class_="clock")
        if not clock_span:
            return None

        # Get the raw text, strip icons and extra whitespace
        raw_text = clock_span.get_text(separator=" ", strip=True)
        # Clean up multiple spaces
        raw_text = re.sub(r"\s+", " ", raw_text).strip()

        return try_parse(raw_text)
