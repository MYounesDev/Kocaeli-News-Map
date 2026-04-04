"""
Duplicate detection using sentence embeddings and cosine similarity.

Uses a multilingual sentence-transformer model to compute embeddings
and compares new articles against existing ones in MongoDB.

Optimized: batch encoding and matrix-based cosine similarity.

NOTE: On Vercel, sentence-transformers is not available due to size limits.
      Functions gracefully degrade and return empty/no-match results.
"""

import logging
from typing import Optional

from app.config import get_settings
from app.database import get_db

logger = logging.getLogger(__name__)

# Try to import ML dependencies — they may not be available on Vercel
try:
    import numpy as np
    from sentence_transformers import SentenceTransformer
    from sklearn.metrics.pairwise import cosine_similarity
    ML_AVAILABLE = True
except ImportError:
    ML_AVAILABLE = False
    logger.warning(
        "sentence-transformers / scikit-learn not available. "
        "Duplicate detection is disabled (expected on Vercel)."
    )

# Global model instance (loaded once)
_model = None


def load_model():
    """Load the sentence transformer model (lazy singleton)."""
    global _model
    if not ML_AVAILABLE:
        logger.warning("ML libraries not available — cannot load embedding model")
        return None
    if _model is None:
        settings = get_settings()
        logger.info(f"Loading embedding model: {settings.EMBEDDING_MODEL}")
        _model = SentenceTransformer(settings.EMBEDDING_MODEL)
        logger.info("Embedding model loaded successfully")
    return _model


def compute_embedding(text: str) -> list[float]:
    """
    Compute the sentence embedding for a given text.

    Returns an empty list if ML libraries are not available.
    """
    if not ML_AVAILABLE:
        return []
    model = load_model()
    if model is None:
        return []
    # Truncate to avoid memory issues (model has max sequence length)
    truncated = text[:1000]
    embedding = model.encode(truncated, show_progress_bar=False)
    return embedding.tolist()


def compute_embeddings_batch(texts: list[str]) -> list[list[float]]:
    """
    Compute embeddings for multiple texts in a single batch call.

    Returns empty lists if ML libraries are not available.
    """
    if not texts:
        return []
    if not ML_AVAILABLE:
        return [[] for _ in texts]
    model = load_model()
    if model is None:
        return [[] for _ in texts]
    truncated = [t[:1000] for t in texts]
    embeddings = model.encode(truncated, show_progress_bar=False, batch_size=32)
    return [emb.tolist() for emb in embeddings]


async def find_duplicate(
    embedding: list[float],
    category: str,
) -> Optional[str]:
    """
    Check if a similar article already exists in the database.

    Returns None immediately if ML libraries are not available.
    """
    if not ML_AVAILABLE or not embedding:
        return None

    settings = get_settings()
    db = get_db()
    news_collection = db["news"]

    # Fetch all existing embeddings in the same category at once
    cursor = news_collection.find(
        {"category": category, "embedding": {"$exists": True, "$ne": []}},
        {"_id": 1, "embedding": 1},
    )

    docs = await cursor.to_list(length=None)
    if not docs:
        return None

    # Vectorized cosine similarity — single matrix multiply
    new_emb = np.array(embedding).reshape(1, -1)
    existing_matrix = np.array([d["embedding"] for d in docs])
    similarities = cosine_similarity(new_emb, existing_matrix)[0]

    max_idx = int(similarities.argmax())
    if similarities[max_idx] >= settings.SIMILARITY_THRESHOLD:
        logger.info(
            f"Duplicate found (similarity={similarities[max_idx]:.3f}): {docs[max_idx]['_id']}"
        )
        return str(docs[max_idx]["_id"])

    return None


async def merge_sources(existing_id: str, new_source_name: str, new_source_url: str) -> None:
    """
    Add a new source to an existing article's sources list.
    Called when a duplicate is detected from a different news site.
    """
    db = get_db()
    news_collection = db["news"]

    from bson import ObjectId

    await news_collection.update_one(
        {"_id": ObjectId(existing_id)},
        {
            "$addToSet": {
                "sources": {
                    "name": new_source_name,
                    "url": new_source_url,
                }
            }
        },
    )
    logger.info(f"Merged source '{new_source_name}' into article {existing_id}")
