"""
News API endpoints.

Provides REST endpoints for querying, filtering, and retrieving news articles.
"""

import math
import logging
from datetime import datetime
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query

from app.database import get_db
from app.models.news import NewsArticleResponse, NewsListResponse, StatsResponse
from app.services.geocoder import geocode
from app.services.location import extract_location
from app.config import get_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/news", tags=["news"])


def _serialize_article(doc: dict) -> dict:
    """Convert a MongoDB document to a serializable dict."""
    return {
        "id": str(doc["_id"]),
        "title": doc.get("title", ""),
        "content": doc.get("content", ""),
        "category": doc.get("category", ""),
        "location_text": doc.get("location_text"),
        "latitude": doc.get("latitude"),
        "longitude": doc.get("longitude"),
        "published_at": doc.get("published_at"),
        "source_name": doc.get("source_name", ""),
        "source_url": doc.get("source_url", ""),
        "sources": doc.get("sources", []),
        "created_at": doc.get("created_at"),
    }


@router.get("/categories", response_model=list[str])
async def get_categories():
    """Get all distinct news categories."""
    db = get_db()
    categories = await db["news"].distinct("category")
    return sorted(categories)


@router.get("/districts", response_model=list[str])
async def get_districts():
    """Get all distinct location texts (districts)."""
    db = get_db()
    districts = await db["news"].distinct("location_text")
    # Filter out None values
    return sorted([d for d in districts if d])


@router.get("/sources", response_model=list[str])
async def get_sources():
    """Get all distinct source names."""
    db = get_db()
    sources = await db["news"].distinct("source_name")
    return sorted(sources)


@router.get("/stats", response_model=StatsResponse)
async def get_stats():
    """Get article statistics grouped by category, source, and district."""
    db = get_db()
    collection = db["news"]

    total = await collection.count_documents({})

    # Category counts
    category_pipeline = [
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    by_category = {}
    async for doc in collection.aggregate(category_pipeline):
        by_category[doc["_id"]] = doc["count"]

    # Source counts
    source_pipeline = [
        {"$group": {"_id": "$source_name", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    by_source = {}
    async for doc in collection.aggregate(source_pipeline):
        by_source[doc["_id"]] = doc["count"]

    # District counts
    district_pipeline = [
        {"$match": {"location_text": {"$ne": None}}},
        {"$group": {"_id": "$location_text", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    by_district = {}
    async for doc in collection.aggregate(district_pipeline):
        by_district[doc["_id"]] = doc["count"]

    return StatsResponse(
        total_articles=total,
        by_category=by_category,
        by_source=by_source,
        by_district=by_district,
    )


@router.delete("/all")
async def delete_all_articles():
    """
    Delete ALL news articles from the database.

    WARNING: This is destructive and cannot be undone.
    Returns the count of deleted documents.
    """
    db = get_db()
    result = await db["news"].delete_many({})
    return {
        "deleted_count": result.deleted_count,
        "message": f"Successfully deleted {result.deleted_count} articles.",
    }


@router.get("/{article_id}", response_model=NewsArticleResponse)
async def get_article(article_id: str):
    """Get a single article by ID."""
    db = get_db()

    try:
        doc = await db["news"].find_one({"_id": ObjectId(article_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid article ID format")

    if not doc:
        raise HTTPException(status_code=404, detail="Article not found")

    return _serialize_article(doc)


@router.get("", response_model=NewsListResponse)
async def list_articles(
    category: Optional[str] = Query(None, description="Filter by category"),
    district: Optional[str] = Query(None, description="Filter by location/district"),
    source: Optional[str] = Query(None, description="Filter by source name"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    search: Optional[str] = Query(None, description="Search in title and content"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
):
    """
    List articles with optional filters.

    Supports filtering by category, district, source, date range, and text search.
    Results are paginated and sorted by published_at descending.
    """
    db = get_db()
    collection = db["news"]

    # Build query filter
    query: dict = {}

    if category:
        query["category"] = category

    if district:
        query["location_text"] = {"$regex": district, "$options": "i"}

    if source:
        query["source_name"] = source

    if start_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            query.setdefault("published_at", {})["$gte"] = start_dt
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format. Use YYYY-MM-DD")

    if end_date:
        try:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
            query.setdefault("published_at", {})["$lte"] = end_dt
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format. Use YYYY-MM-DD")

    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"content": {"$regex": search, "$options": "i"}},
        ]

    # Count total matching documents
    total = await collection.count_documents(query)

    # Fetch paginated results (exclude embedding from response)
    skip = (page - 1) * limit
    cursor = collection.find(
        query,
        {"embedding": 0},  # Exclude embedding field
    ).sort("published_at", -1).skip(skip).limit(limit)

    articles = []
    async for doc in cursor:
        articles.append(_serialize_article(doc))

    total_pages = math.ceil(total / limit) if total > 0 else 1

    return NewsListResponse(
        articles=articles,
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages,
    )


# ─── DIAGNOSTIC ENDPOINTS ───


@router.get("/test-geocoding", tags=["diagnostics"])
async def test_geocoding(location: str = Query(..., description="Location to geocode, e.g. 'Gebze, Kocaeli'")):
    """
    Test if geocoding is working.
    
    Use this to verify:
    1. Google Maps API key is set
    2. Geocoding API is enabled
    3. Location extraction works
    
    Example: /api/news/test-geocoding?location=Gebze%2C%20Kocaeli
    """
    settings = get_settings()
    
    if not settings.GOOGLE_MAPS_API_KEY:
        return {
            "error": "GOOGLE_MAPS_API_KEY not configured in .env",
            "status": "FAILED",
            "suggestion": "Set GOOGLE_MAPS_API_KEY in server/.env"
        }
    
    try:
        result = await geocode(location)
        
        if result:
            return {
                "status": "SUCCESS",
                "location": location,
                "latitude": result["lat"],
                "longitude": result["lng"],
                "formatted_address": result.get("formatted_address", "")
            }
        else:
            return {
                "error": "Geocoding returned no results",
                "status": "FAILED",
                "suggestion": "Check if location is valid, or if Geocoding API is enabled in Google Cloud Console"
            }
    except Exception as e:
        return {
            "error": str(e),
            "status": "FAILED",
            "suggestion": "Check server logs for details"
        }


@router.get("/test-location-extraction", tags=["diagnostics"])
async def test_location_extraction(text: str = Query(..., description="Text to extract location from")):
    """
    Test if location extraction is working.
    
    Example: /api/news/test-location-extraction?text=Incident%20happened%20in%20Gebze%20yesterday
    """
    try:
        location = extract_location(text)
        
        if location:
            return {
                "status": "SUCCESS",
                "input": text,
                "extracted_location": location
            }
        else:
            return {
                "status": "NO_LOCATION_FOUND",
                "input": text,
                "suggestion": "Make sure text contains a known Kocaeli district or neighborhood"
            }
    except Exception as e:
        return {
            "error": str(e),
            "status": "FAILED"
        }


@router.get("/stats-location-data", tags=["diagnostics"])
async def stats_location_data():
    """
    Check how many articles have location data.
    
    Helps diagnose if geocoding pipeline is working.
    """
    db = get_db()
    collection = db["news"]
    
    total = await collection.count_documents({})
    with_location_text = await collection.count_documents({"location_text": {"$ne": None}})
    with_coords = await collection.count_documents({"latitude": {"$ne": None}, "longitude": {"$ne": None}})
    without_coords = with_location_text - with_coords
    
    return {
        "total_articles": total,
        "with_location_text": with_location_text,
        "with_latitude_longitude": with_coords,
        "with_location_text_but_no_coords": without_coords,
        "percentage_geocoded": f"{(with_coords / total * 100):.1f}%" if total > 0 else "N/A",
        "status": "OK" if with_coords > 0 else "WARNING: No articles have coordinates"
    }
