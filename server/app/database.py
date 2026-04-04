"""
Async MongoDB connection using Motor.
"""

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config import get_settings

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


async def connect_db() -> None:
    """Initialize MongoDB connection and create indexes."""
    global _client, _db
    settings = get_settings()
    _client = AsyncIOMotorClient(settings.MONGODB_URI)
    _db = _client[settings.DATABASE_NAME]

    # Create indexes for the news collection
    news = _db["news"]
    await news.create_index("source_url", unique=True)
    await news.create_index("category")
    await news.create_index("published_at")
    await news.create_index("location_text")
    await news.create_index("source_name")

    # Geocode cache index
    cache = _db["geocode_cache"]
    await cache.create_index("location_text", unique=True)

    print("[OK] Connected to MongoDB")


async def close_db() -> None:
    """Close MongoDB connection."""
    global _client, _db
    if _client:
        _client.close()
        _client = None
        _db = None
    print("[OK] Disconnected from MongoDB")


def is_connected() -> bool:
    """Check if the database is currently connected."""
    return _db is not None


def get_db() -> AsyncIOMotorDatabase:
    """Get the database instance."""
    if _db is None:
        raise RuntimeError("Database not initialized. Call connect_db() first.")
    return _db
