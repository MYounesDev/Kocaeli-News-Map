"""
Kocaeli Local News Map — FastAPI Backend

Main application entry point.
Adapted for Vercel serverless deployment.
"""

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.database import connect_db, is_connected
from app.routers import news, scraper

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


# Create FastAPI application
app = FastAPI(
    title="Kocaeli News Map API",
    description="Backend API for the Kocaeli Local News Map project. "
                "Scrapes local news, classifies them, extracts locations, "
                "and serves data for Google Maps visualization.",
    version="1.0.0",
)

# CORS middleware (allow Next.js frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def ensure_db_connected(request: Request, call_next):
    """
    Lazy database initialization middleware.

    In serverless environments (Vercel), lifespan events are not supported.
    This middleware ensures the database connection is established on the
    first request and reused for subsequent requests within the same
    function instance.
    """
    if not is_connected():
        logger.info("Initializing database connection (serverless cold start)...")
        await connect_db()
    response = await call_next(request)
    return response


# Include routers
app.include_router(news.router)
app.include_router(scraper.router)


@app.get("/", tags=["health"])
async def root():
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "Kocaeli News Map API",
        "version": "1.0.0",
    }


@app.get("/api/health", tags=["health"])
async def health_check():
    """Detailed health check."""
    from app.database import get_db
    try:
        db = get_db()
        # Test MongoDB connection
        await db.command("ping")
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {e}"

    return {
        "status": "ok" if db_status == "connected" else "degraded",
        "database": db_status,
    }


# Vercel requires the ASGI app to be named `app` — which it already is.
# For local development, run with: uvicorn main:app --reload
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
