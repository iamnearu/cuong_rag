"""
Embedding Service
=================
Generates vector embeddings using sentence-transformers.

Default model: BAAI/bge-m3 (1024-dim, multilingual, 100+ languages).
Configurable via CUONGRAG_EMBEDDING_MODEL in settings.
"""
from __future__ import annotations

import logging
from typing import Sequence, Optional, Any

import requests

from app.core.config import settings

logger = logging.getLogger(__name__)


class EmbeddingService:
    """
    Service for generating text embeddings.

    Modes:
    - API mode: when CUONGRAG_EMBEDDING_API_URL is set
    - Local mode: sentence-transformers fallback
    """

    # Dimension lookup for common models (used before model is loaded)
    _KNOWN_DIMS = {
        "BAAI/bge-m3": 1024,
        "all-MiniLM-L6-v2": 384,
        "all-mpnet-base-v2": 768,
        "paraphrase-multilingual-MiniLM-L12-v2": 384,
        "intfloat/multilingual-e5-large-instruct": 1024,
    }

    def __init__(self, model_name: Optional[str] = None):
        self.model_name = model_name or settings.CUONGRAG_EMBEDDING_MODEL
        self._model = None
        self._api_url = (getattr(settings, "CUONGRAG_EMBEDDING_API_URL", "") or "").strip()
        self._api_timeout = float(getattr(settings, "CUONGRAG_EMBEDDING_API_TIMEOUT", 30.0) or 30.0)
        self._api_key = (getattr(settings, "CUONGRAG_EMBEDDING_API_KEY", "") or "").strip()
        self._api_model = (getattr(settings, "CUONGRAG_EMBEDDING_API_MODEL", "") or "").strip()
        self._api_dimensions = int(getattr(settings, "CUONGRAG_EMBEDDING_API_DIMENSIONS", 0) or 0)
        self._api_encoding_format = (
            getattr(settings, "CUONGRAG_EMBEDDING_API_ENCODING_FORMAT", "float") or "float"
        ).strip()

    def _api_headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self._api_key:
            headers["Authorization"] = f"Bearer {self._api_key}"
        return headers

    def _extract_embeddings(self, data: Any) -> list[list[float]] | None:
        if isinstance(data, dict) and isinstance(data.get("embeddings"), list):
            return data["embeddings"]

        if isinstance(data, dict) and isinstance(data.get("data"), list):
            rows: list[tuple[int, list[float]]] = []
            for i, item in enumerate(data["data"]):
                if isinstance(item, dict) and isinstance(item.get("embedding"), list):
                    idx = int(item.get("index", i))
                    rows.append((idx, item["embedding"]))
            if rows:
                rows.sort(key=lambda x: x[0])
                return [row for _, row in rows]

        if isinstance(data, list) and data and isinstance(data[0], list):
            return data

        return None

    def _embed_via_api(self, texts: Sequence[str]) -> list[list[float]] | None:
        if not self._api_url:
            return None

        base = self._api_url.rstrip("/")
        candidates = [
            base,
            f"{base}/embed",
            f"{base}/embeddings",
            f"{base}/v1/embeddings",
        ]

        openai_payload: dict[str, Any] = {
            "model": self._api_model or self.model_name,
            "input": list(texts),
        }
        if self._api_dimensions > 0:
            openai_payload["dimensions"] = self._api_dimensions
        if self._api_encoding_format:
            openai_payload["encoding_format"] = self._api_encoding_format

        # Backward-compatible payload for legacy embedding gateways
        legacy_payload: dict[str, Any] = {
            "model": self._api_model or self.model_name,
            "input": list(texts),
            "texts": list(texts),
        }

        payload_candidates = [openai_payload, legacy_payload]
        headers = self._api_headers()

        last_err: Exception | None = None
        for url in candidates:
            for payload in payload_candidates:
                try:
                    resp = requests.post(url, json=payload, headers=headers, timeout=self._api_timeout)
                    resp.raise_for_status()
                    parsed = self._extract_embeddings(resp.json())
                    if parsed is not None:
                        return parsed
                except Exception as e:
                    last_err = e
                    continue

        if last_err:
            logger.warning("Embedding API failed, fallback to local model: %s", last_err)
        return None

    @property
    def model(self):
        """Lazy load the model."""
        if self._model is None:
            from sentence_transformers import SentenceTransformer
            logger.info(f"Loading embedding model: {self.model_name}")
            self._model = SentenceTransformer(
                self.model_name,
                device=settings.CUONGRAG_EMBEDDING_DEVICE,
            )
            logger.info(
                f"Embedding model loaded: {self.model_name} "
                f"(dim={self._model.get_sentence_embedding_dimension()})"
            )
        return self._model

    @property
    def dimension(self) -> int:
        """Return the embedding dimension size."""
        if self._model is not None:
            return self._model.get_sentence_embedding_dimension()
        return self._KNOWN_DIMS.get(self.model_name, 1024)

    def embed_text(self, text: str) -> list[float]:
        """Generate embedding for a single text."""
        if not text.strip():
            raise ValueError("Cannot embed empty text")
        via_api = self._embed_via_api([text])
        if via_api is not None and via_api:
            return [float(x) for x in via_api[0]]
        embedding = self.model.encode(
            text,
            convert_to_numpy=True,
            normalize_embeddings=True,
        )
        return embedding.tolist()

    def embed_texts(self, texts: Sequence[str]) -> list[list[float]]:
        """Generate embeddings for multiple texts in batch."""
        if not texts:
            return []
        valid_texts = [t for t in texts if t.strip()]
        if not valid_texts:
            raise ValueError("All texts are empty")

        via_api = self._embed_via_api(valid_texts)
        if via_api is not None:
            return [[float(x) for x in row] for row in via_api]

        embeddings = self.model.encode(
            valid_texts,
            convert_to_numpy=True,
            normalize_embeddings=True,
            batch_size=32,
        )
        return embeddings.tolist()

    def embed_query(self, query: str) -> list[float]:
        """Generate embedding for a search query."""
        return self.embed_text(query)


# Default service instance (singleton)
_default_service: Optional[EmbeddingService] = None


def get_embedding_service() -> EmbeddingService:
    """Get or create the default embedding service."""
    global _default_service
    if _default_service is None:
        _default_service = EmbeddingService()
    return _default_service


def embed_text(text: str) -> list[float]:
    """Convenience function to embed a single text."""
    return get_embedding_service().embed_text(text)


def embed_texts(texts: Sequence[str]) -> list[list[float]]:
    """Convenience function to embed multiple texts."""
    return get_embedding_service().embed_texts(texts)
