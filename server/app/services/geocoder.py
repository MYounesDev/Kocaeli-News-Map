"""
Google Geocoding API wrapper with MongoDB caching.

Converts location text to latitude/longitude coordinates.
Caches results to avoid redundant API calls.

Optimized: reuses a single httpx.AsyncClient instead of creating one per call.
"""

import logging
from typing import Optional

import httpx

from app.config import get_settings
from app.database import get_db

logger = logging.getLogger(__name__)

GEOCODING_URL = "https://maps.googleapis.com/maps/api/geocode/json"

# Module-level client for connection reuse across geocode calls
_geocode_client: Optional[httpx.AsyncClient] = None


def _get_geocode_client() -> httpx.AsyncClient:
    """Get or create a reusable httpx client for geocoding."""
    global _geocode_client
    if _geocode_client is None or _geocode_client.is_closed:
        _geocode_client = httpx.AsyncClient(timeout=10)
    return _geocode_client


async def geocode(location_text: str) -> Optional[dict]:
    """
    Geocode a location string to coordinates.

    Args:
        location_text: Location string (e.g., "Gebze, Kocaeli")

    Returns:
        dict with keys: lat, lng, formatted_address, or None if failed.
    """
    if not location_text:
        logger.debug(f"geocode: Empty location_text provided")
        return None

    settings = get_settings()
    if not settings.GOOGLE_MAPS_API_KEY:
        logger.error("⚠️  GOOGLE_MAPS_API_KEY not configured in .env - Geocoding will not work!")
        return None

    # 1. Check cache first
    db = get_db()
    cache = db["geocode_cache"]

    cached = await cache.find_one({"location_text": location_text})
    if cached:
        return {
            "lat": cached["lat"],
            "lng": cached["lng"],
            "formatted_address": cached.get("formatted_address", ""),
        }

    # 2. Call Google Geocoding API
    # Append "Kocaeli, Turkey" for context if not already present
    query = location_text
    if "kocaeli" not in location_text.lower():
        query = f"{location_text}, Kocaeli, Turkey"
    elif "turkey" not in location_text.lower() and "türkiye" not in location_text.lower():
        query = f"{location_text}, Turkey"

    try:
        client = _get_geocode_client()
        response = await client.get(
            GEOCODING_URL,
            params={
                "address": query,
                "key": settings.GOOGLE_MAPS_API_KEY,
                "language": "tr",
                "region": "tr",
            },
        )
        data = response.json()

        if data.get("status") != "OK" or not data.get("results"):
            error_msg = (
                f"Geocoding failed for '{location_text}': {data.get('status')} "
                f"(status={data.get('status')}, has_results={bool(data.get('results'))})"
            )
            logger.warning(f"⚠️  {error_msg}")
            if data.get("status") == "ZERO_RESULTS":
                logger.warning(f"   → Try a broader location like 'Kocaeli, Turkey'")
            return None

        result = data["results"][0]
        geo = result["geometry"]["location"]

        geocode_result = {
            "lat": geo["lat"],
            "lng": geo["lng"],
            "formatted_address": result.get("formatted_address", ""),
        }

        # 3. Cache the result
        await cache.update_one(
            {"location_text": location_text},
            {"$set": {
                "location_text": location_text,
                "lat": geocode_result["lat"],
                "lng": geocode_result["lng"],
                "formatted_address": geocode_result["formatted_address"],
            }},
            upsert=True,
        )

        logger.info(f"Geocoded '{location_text}' -> ({geocode_result['lat']}, {geocode_result['lng']})")
        return geocode_result

    except Exception as e:
        logger.error(f"❌ Geocoding error for '{location_text}': {e}")
        logger.error(f"   Ensure 'Geocoding API' is enabled in Google Cloud Console for this key")
        return None
