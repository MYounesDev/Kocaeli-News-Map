"""
Pydantic models for News articles.
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class NewsSource(BaseModel):
    """Represents a single source for a news article."""
    name: str
    url: str


class NewsArticleBase(BaseModel):
    """Base fields for a news article."""
    title: str
    content: str
    category: str
    location_text: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    published_at: datetime
    source_name: str
    source_url: str
    sources: list[NewsSource] = Field(default_factory=list)


class NewsArticleCreate(NewsArticleBase):
    """Model for creating a new article (includes embedding)."""
    embedding: list[float] = Field(default_factory=list)


class NewsArticleDB(NewsArticleBase):
    """Model for an article as stored in MongoDB."""
    id: str = Field(alias="_id")
    embedding: list[float] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = {"populate_by_name": True}


class NewsArticleResponse(BaseModel):
    """Response model (excludes embedding for API responses)."""
    id: str
    title: str
    content: str
    category: str
    location_text: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    published_at: datetime
    source_name: str
    source_url: str
    sources: list[NewsSource] = Field(default_factory=list)
    created_at: Optional[datetime] = None


class NewsListResponse(BaseModel):
    """Paginated list of articles."""
    articles: list[NewsArticleResponse]
    total: int
    page: int
    limit: int
    total_pages: int


class ScrapeRequest(BaseModel):
    """Request body to trigger a scrape."""
    days: int = Field(default=3, ge=1, le=30)
    sources: list[str] = Field(default=["all"])


class ScrapeStatusResponse(BaseModel):
    """Response for scrape status."""
    is_running: bool
    message: str
    articles_scraped: int = 0
    articles_saved: int = 0
    errors: list[str] = Field(default_factory=list)


class StatsResponse(BaseModel):
    """Statistics about stored articles."""
    total_articles: int
    by_category: dict[str, int]
    by_source: dict[str, int]
    by_district: dict[str, int]
