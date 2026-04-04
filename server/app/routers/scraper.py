"""
Scraper API endpoints.

Provides endpoints to trigger and monitor the scraping pipeline.

Optimized:
- All scrapers run in parallel via asyncio.gather()
- Early URL dedup skips already-scraped articles before processing
- Article processing uses bounded concurrency
"""

import asyncio
import logging
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks

from app.database import get_db
from app.models.news import ScrapeRequest, ScrapeStatusResponse
from app.services.classifier import classify
from app.services.duplicate import compute_embedding, find_duplicate, merge_sources
from app.services.geocoder import geocode
from app.services.location import extract_location
from app.services.preprocessor import preprocess
from app.services.scraper.base import RawArticle
from app.services.scraper.bizimyaka import BizimYakaScraper
from app.services.scraper.cagdas import CagdasKocaeliScraper
from app.services.scraper.ozgur import OzgurKocaeliScraper
from app.services.scraper.ses import SesKocaeliScraper
from app.services.scraper.yenikocaeli import YeniKocaeliScraper

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/scrape", tags=["scraper"])

# Scraping state
_scrape_state = {
    "is_running": False,
    "message": "Idle",
    "articles_scraped": 0,
    "articles_saved": 0,
    "errors": [],
}

# All available scrapers
SCRAPERS = {
    "cagdaskocaeli": CagdasKocaeliScraper,
    "ozgurkocaeli": OzgurKocaeliScraper,
    "seskocaeli": SesKocaeliScraper,
    "bizimyaka": BizimYakaScraper,
    "yenikocaeli": YeniKocaeliScraper,
}

# Max concurrent article processing tasks
PROCESS_CONCURRENCY = 5


async def _process_article(article: RawArticle, known_urls: set[str]) -> bool:
    """
    Process a single scraped article through the full pipeline:
    1. Skip if URL already known
    2. Preprocess text
    3. Classify category
    4. Extract location
    5. Geocode location
    6. Compute embedding
    7. Check for duplicates
    8. Save to MongoDB

    Returns True if article was saved, False if skipped (duplicate/error).
    """
    # 0. Early skip — URL already in the database
    if article.source_url in known_urls:
        logger.info(f"URL already known, skipping: {article.source_url}")
        return False

    db = get_db()
    collection = db["news"]

    try:
        # 1. Preprocess content
        clean_content = preprocess(article.content) if article.content else ""
        if not clean_content:
            return False

        # 2. Classify
        category = classify(clean_content, article.category)

        # 3. Extract location
        search_text = f"{article.title} {clean_content}"
        location_text = extract_location(search_text)

        # 4. Geocode
        latitude = None
        longitude = None
        if location_text:
            geo_result = await geocode(location_text)
            if geo_result:
                latitude = geo_result["lat"]
                longitude = geo_result["lng"]

        # 5. Compute embedding for duplicate detection
        embedding_text = f"{article.title} {clean_content[:500]}"
        embedding = compute_embedding(embedding_text)

        # 6. Check for duplicates
        duplicate_id = await find_duplicate(embedding, category)
        if duplicate_id:
            # Merge this source into the existing article
            await merge_sources(duplicate_id, article.source_name, article.source_url)
            logger.info(f"Duplicate merged: {article.title[:50]}...")
            return False

        # 7. Check if URL already exists (race-condition safety)
        existing = await collection.find_one({"source_url": article.source_url})
        if existing:
            logger.info(f"URL already exists: {article.source_url}")
            return False

        # 8. Save to MongoDB
        doc = {
            "title": article.title,
            "content": clean_content,
            "category": category,
            "location_text": location_text,
            "latitude": latitude,
            "longitude": longitude,
            "published_at": article.published_at,
            "source_name": article.source_name,
            "source_url": article.source_url,
            "sources": [{"name": article.source_name, "url": article.source_url}],
            "embedding": embedding,
            "created_at": datetime.utcnow(),
        }

        await collection.insert_one(doc)
        logger.info(f"Saved: {article.title[:50]}...")
        return True

    except Exception as e:
        logger.error(f"Error processing article '{article.title[:50]}': {e}")
        return False


async def _scrape_single_source(scraper_class, days: int) -> tuple[str, list[RawArticle], str | None]:
    """
    Run a single scraper and return its results.

    Returns:
        Tuple of (source_name, articles, error_message_or_None)
    """
    scraper = scraper_class()
    try:
        articles = await scraper.scrape(days=days)
        logger.info(f"Scraped {len(articles)} from {scraper.source_name}")
        return scraper.source_name, articles, None
    except Exception as e:
        error_msg = f"Error scraping {scraper.source_name}: {e}"
        logger.error(error_msg)
        return scraper.source_name, [], error_msg


async def _run_scraping(days: int, source_names: list[str]):
    """Background task to run the full scraping pipeline."""
    global _scrape_state

    _scrape_state["is_running"] = True
    _scrape_state["message"] = "Scraping in progress..."
    _scrape_state["articles_scraped"] = 0
    _scrape_state["articles_saved"] = 0
    _scrape_state["errors"] = []

    try:
        # Determine which scrapers to use
        if "all" in source_names:
            scrapers_to_run = list(SCRAPERS.values())
        else:
            scrapers_to_run = [
                SCRAPERS[name] for name in source_names if name in SCRAPERS
            ]

        if not scrapers_to_run:
            _scrape_state["message"] = "No valid sources specified"
            _scrape_state["is_running"] = False
            return

        # ── Phase 1: Scrape ALL sources in parallel ──
        _scrape_state["message"] = f"Scraping {len(scrapers_to_run)} sources in parallel..."

        results = await asyncio.gather(
            *[_scrape_single_source(cls, days) for cls in scrapers_to_run],
            return_exceptions=True,
        )

        all_articles: list[RawArticle] = []
        for result in results:
            if isinstance(result, Exception):
                error_msg = f"Scraper exception: {result}"
                _scrape_state["errors"].append(error_msg)
                logger.error(error_msg)
                continue

            source_name, articles, error = result
            if error:
                _scrape_state["errors"].append(error)
            all_articles.extend(articles)
            _scrape_state["articles_scraped"] += len(articles)

        # ── Phase 1.5: Early URL deduplication ──
        _scrape_state["message"] = "Checking for already-scraped URLs..."
        db = get_db()
        collection = db["news"]

        # Fetch all known URLs from DB in one query
        article_urls = [a.source_url for a in all_articles]
        if article_urls:
            existing_docs = await collection.find(
                {"source_url": {"$in": article_urls}},
                {"source_url": 1},
            ).to_list(length=None)
            known_urls = {doc["source_url"] for doc in existing_docs}
        else:
            known_urls = set()

        new_articles = [a for a in all_articles if a.source_url not in known_urls]
        skipped = len(all_articles) - len(new_articles)
        if skipped:
            logger.info(f"Skipped {skipped} already-scraped articles via early URL dedup")

        # ── Phase 2: Process articles with bounded concurrency ──
        _scrape_state["message"] = f"Processing {len(new_articles)} new articles ({skipped} skipped)..."
        saved_count = 0
        semaphore = asyncio.Semaphore(PROCESS_CONCURRENCY)

        async def _process_bounded(article: RawArticle) -> bool:
            async with semaphore:
                return await _process_article(article, known_urls)

        # Process in chunks to update progress
        chunk_size = 10
        for start in range(0, len(new_articles), chunk_size):
            chunk = new_articles[start : start + chunk_size]
            results = await asyncio.gather(
                *[_process_bounded(a) for a in chunk],
                return_exceptions=True,
            )

            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    error_msg = f"Error processing: {chunk[i].title[:50]}: {result}"
                    _scrape_state["errors"].append(error_msg)
                    logger.error(error_msg)
                elif result:
                    saved_count += 1

            _scrape_state["articles_saved"] = saved_count
            processed = min(start + chunk_size, len(new_articles))
            _scrape_state["message"] = (
                f"Processing articles... ({processed}/{len(new_articles)})"
            )

        _scrape_state["message"] = (
            f"Completed! Scraped {_scrape_state['articles_scraped']}, "
            f"saved {saved_count} new articles "
            f"({skipped} skipped as already scraped)."
        )

    except Exception as e:
        _scrape_state["message"] = f"Scraping failed: {e}"
        _scrape_state["errors"].append(str(e))
        logger.error(f"Scraping pipeline error: {e}")

    finally:
        _scrape_state["is_running"] = False


@router.post("", response_model=ScrapeStatusResponse)
async def trigger_scrape(request: ScrapeRequest, background_tasks: BackgroundTasks):
    """
    Trigger the scraping pipeline as a background task.

    Body:
    - days: Number of days to scrape (default 3)
    - sources: List of source names, or ["all"] for all sources

    WARNING: On Vercel serverless, background tasks will be terminated when
    the response is sent. Run scraping from a local machine or dedicated
    server instead. The API read endpoints work fine on Vercel.
    """
    if _scrape_state["is_running"]:
        return ScrapeStatusResponse(
            is_running=True,
            message="Scraping is already in progress. Please wait.",
            articles_scraped=_scrape_state["articles_scraped"],
            articles_saved=_scrape_state["articles_saved"],
            errors=_scrape_state["errors"],
        )

    # Start scraping in background
    background_tasks.add_task(_run_scraping, request.days, request.sources)

    return ScrapeStatusResponse(
        is_running=True,
        message=f"Scraping started for {request.days} days from {request.sources}",
        articles_scraped=0,
        articles_saved=0,
        errors=[],
    )


@router.get("/status", response_model=ScrapeStatusResponse)
async def get_scrape_status():
    """Check the current status of the scraping pipeline."""
    return ScrapeStatusResponse(
        is_running=_scrape_state["is_running"],
        message=_scrape_state["message"],
        articles_scraped=_scrape_state["articles_scraped"],
        articles_saved=_scrape_state["articles_saved"],
        errors=_scrape_state["errors"],
    )
