"""
Scraper for bizimyaka.com

Same archive page logic as cagdaskocaeli.com.tr:
/arsiv/{YYYY-MM-DD} with div.f-cat.f-item blocks.
"""

import logging
from datetime import datetime, timedelta

from bs4 import BeautifulSoup

from app.services.preprocessor import extract_article_content
from app.services.scraper.base import BaseScraper, RawArticle

logger = logging.getLogger(__name__)


class BizimYakaScraper(BaseScraper):
    """Scraper for Bizim Yaka news site."""

    @property
    def source_name(self) -> str:
        return "bizimyaka"

    @property
    def base_url(self) -> str:
        return "https://www.bizimyaka.com"

    async def scrape(self, days: int = 3) -> list[RawArticle]:
        articles = []
        today = datetime.now()

        async with self.get_client() as client:
            for day_offset in range(days):
                date = today - timedelta(days=day_offset)
                date_str = date.strftime("%Y-%m-%d")
                archive_url = f"{self.base_url}/arsiv/{date_str}"

                logger.info(f"[{self.source_name}] Scraping archive: {archive_url}")
                html = await self.fetch_page(client, archive_url)
                if not html:
                    continue

                day_articles = self._parse_archive_page(html, date)

                # Fetch full content for all articles concurrently
                urls = [a.source_url for a in day_articles]
                pages = await self.fetch_pages_concurrent(client, urls)
                for article, content_html in zip(day_articles, pages):
                    if content_html:
                        article.content = extract_article_content(content_html)
                        article.content_html = content_html
                    if article.content:
                        articles.append(article)

                logger.info(f"[{self.source_name}] {date_str}: {len(day_articles)} articles found")

        logger.info(f"[{self.source_name}] Total: {len(articles)} articles scraped")
        return articles

    def _parse_archive_page(self, html: str, date: datetime) -> list[RawArticle]:
        soup = BeautifulSoup(html, "lxml")
        articles = []

        category_blocks = soup.find_all("div", class_="f-cat f-item")

        for block in category_blocks:
            h3 = block.find("h3")
            if not h3:
                continue
            category = h3.get_text(strip=True)

            list_items = block.find_all("li")
            for li in list_items:
                link = li.find("a", href=True)
                time_tag = li.find("time")

                if not link:
                    continue

                href = link["href"]
                title = link.get_text(strip=True)

                if href.startswith("/"):
                    full_url = f"{self.base_url}{href}"
                elif href.startswith("http"):
                    full_url = href
                else:
                    full_url = f"{self.base_url}/{href}"

                publish_time = "00:00"
                if time_tag:
                    publish_time = time_tag.get_text(strip=True)

                try:
                    hour, minute = publish_time.split(":")[:2]
                    published_at = date.replace(
                        hour=int(hour), minute=int(minute), second=0, microsecond=0
                    )
                except (ValueError, IndexError):
                    published_at = date.replace(hour=0, minute=0, second=0, microsecond=0)

                articles.append(RawArticle(
                    title=title,
                    content="",
                    category=category,
                    published_at=published_at,
                    source_name=self.source_name,
                    source_url=full_url,
                ))

        return articles
