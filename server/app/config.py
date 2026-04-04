"""
Application configuration loaded from environment variables.
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # MongoDB
    MONGODB_URI: str = "mongodb+srv://admin:yh805522@cluster000.32mwlq1.mongodb.net/?appName=Cluster000"
    DATABASE_NAME: str = "kocaeli_news"

    # Google Maps
    GOOGLE_MAPS_API_KEY: str = "AIzaSyC9IvR5glUs-9-89qY6_0DrNWDh0gZ4OaA"

    # Scraping
    DEFAULT_SCRAPE_DAYS: int = 3
    REQUEST_DELAY: float = 0.3  # seconds between requests (rate-limit per domain)
    SCRAPE_CONCURRENCY: int = 10  # max concurrent article fetches per source

    # Embedding model
    EMBEDDING_MODEL: str = "paraphrase-multilingual-MiniLM-L12-v2"
    SIMILARITY_THRESHOLD: float = 0.90

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


@lru_cache()
def get_settings() -> Settings:
    return Settings()
