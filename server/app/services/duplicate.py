"""
Duplicate detection using sentence embeddings and cosine similarity.

Uses a multilingual sentence-transformer model to compute embeddings
and compares new articles against existing ones in MongoDB.

Optimized: batch encoding and matrix-based cosine similarity.
"""

import logging
from typing import Optional

import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

from app.config import get_settings
from app.database import get_db

logger = logging.getLogger(__name__)

# Global model instance (loaded once)
_model: Optional[SentenceTransformer] = None


def load_model() -> SentenceTransformer:
    """Load the sentence transformer model (lazy singleton)."""
    global _model
    if _model is None:
        settings = get_settings()
        logger.info(f"Loading embedding model: {settings.EMBEDDING_MODEL}")
        _model = SentenceTransformer(settings.EMBEDDING_MODEL)
        logger.info("Embedding model loaded successfully")
    return _model


def compute_embedding(text: str) -> list[float]:
    """
    Compute the sentence embedding for a given text.

    Args:
        text: The article text (title + content recommended)

    Returns:
        A list of floats representing the embedding vector.
    """
    model = load_model()
    # Truncate to avoid memory issues (model has max sequence length)
    truncated = text[:1000]
    embedding = model.encode(truncated, show_progress_bar=False)
    return embedding.tolist()


def compute_embeddings_batch(texts: list[str]) -> list[list[float]]:
    """
    Compute embeddings for multiple texts in a single batch call.

    Significantly faster than calling compute_embedding() in a loop
    because sentence-transformers uses GPU/batched inference internally.

    Args:
        texts: List of text strings

    Returns:
        List of embedding vectors
    """
    if not texts:
        return []
    model = load_model()
    truncated = [t[:1000] for t in texts]
    embeddings = model.encode(truncated, show_progress_bar=False, batch_size=32)
    return [emb.tolist() for emb in embeddings]


async def find_duplicate(
    embedding: list[float],
    category: str,
) -> Optional[str]:
    """
    Check if a similar article already exists in the database.

    Only compares against articles in the same category for efficiency.
    Uses vectorized matrix multiplication instead of row-by-row comparison.

    Args:
        embedding: The embedding of the new article
        category: The category to search within

    Returns:
        The _id (as string) of the duplicate article, or None if no duplicate found.
    """
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
