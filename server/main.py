"""
Kocaeli Local News Map — FastAPI Backend

Main application entry point.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import connect_db, close_db
from app.routers import news, scraper

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle: startup and shutdown."""
    # Startup
    logger.info("Starting Kocaeli News Map API...")
    await connect_db()

    # Pre-load the embedding model in background (optional, speeds up first request)
    try:
        from app.services.duplicate import load_model
        load_model()
        logger.info("Embedding model loaded")
    except Exception as e:
        logger.warning(f"Could not pre-load embedding model: {e}")

    yield

    # Shutdown
    logger.info("Shutting down...")
    await close_db()


# Create FastAPI application
app = FastAPI(
    title="Kocaeli News Map API",
    description="Backend API for the Kocaeli Local News Map project. "
                "Scrapes local news, classifies them, extracts locations, "
                "and serves data for Google Maps visualization.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware (allow Next.js frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
