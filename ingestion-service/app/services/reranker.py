"""
Reranker Service
================
Cross-encoder reranker for improving retrieval precision.

Default model: BAAI/bge-reranker-v2-m3 (multilingual, 100+ languages).
Configurable via CUONGRAG_RERANKER_MODEL in settings.

Usage:
    reranker = get_reranker_service()
    ranked = reranker.rerank("user question", ["chunk1", "chunk2", ...], top_k=5)
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional, Sequence

import requests

from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class RerankResult:
    """A single reranked item with its original index and relevance score."""
    index: int          # Original position in the input list
    score: float        # Cross-encoder relevance score (higher = more relevant)
    text: str           # The chunk text


class RerankerService:
    """
    Cross-encoder reranker service.
    Scores (query, document) pairs jointly through a transformer,
    producing far more accurate relevance scores than bi-encoder cosine similarity.
    """

    def __init__(self, model_name: Optional[str] = None):
        self.model_name = model_name or settings.CUONGRAG_RERANKER_MODEL
        self._model = None
        self._api_url = (getattr(settings, "CUONGRAG_RERANKER_API_URL", "") or "").strip()
        self._api_key = (getattr(settings, "CUONGRAG_RERANKER_API_KEY", "") or "").strip()
        self._api_model = (
            getattr(settings, "CUONGRAG_RERANKER_API_MODEL", "") or "bge-reranker-v2-m3"
        ).strip()

    def _api_headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self._api_key:
            headers["Authorization"] = f"Bearer {self._api_key}"
        return headers

    def _rerank_via_api(
        self,
        query: str,
        documents: Sequence[str],
        top_k: Optional[int],
        min_score: Optional[float],
    ) -> list[RerankResult] | None:
        if not self._api_url:
            return None

        url = self._api_url.rstrip("/")
        if not url.endswith("/rerank"):
            url = f"{url}/rerank"

        payload = {
            "model": self._api_model,
            "query": query,
            "documents": list(documents),
            "top_n": top_k,
        }
        if min_score is not None:
            payload["min_score"] = min_score

        payload_legacy = dict(payload)
        payload_legacy["top_k"] = top_k

        try:
            for body in (payload, payload_legacy):
                resp = requests.post(
                    url,
                    json=body,
                    headers=self._api_headers(),
                    timeout=float(getattr(settings, "CUONGRAG_RERANKER_API_TIMEOUT", 10.0)),
                )
                resp.raise_for_status()
                data = resp.json()
                items = data.get("results", data) if isinstance(data, dict) else data
                if not isinstance(items, list):
                    continue

                results: list[RerankResult] = []
                for it in items:
                    if not isinstance(it, dict):
                        continue
                    idx = int(it.get("index", -1))
                    score = float(it.get("relevance_score", it.get("score", 0.0)))
                    if idx < 0 or idx >= len(documents):
                        continue
                    results.append(RerankResult(index=idx, score=score, text=documents[idx]))

                results.sort(key=lambda r: r.score, reverse=True)
                if min_score is not None:
                    results = [r for r in results if r.score >= min_score]
                if top_k is not None:
                    results = results[:top_k]
                return results
        except Exception as e:
            logger.warning(f"External reranker API failed, fallback to local model: {e}")

        return None

    @property
    def model(self):
        """Lazy load the cross-encoder model."""
        if self._model is None:
            from sentence_transformers import CrossEncoder
            logger.info(f"Loading reranker model: {self.model_name}")
            self._model = CrossEncoder(
                self.model_name,
                device=settings.CUONGRAG_RERANKER_DEVICE,
            )
            logger.info(f"Reranker model loaded: {self.model_name}")
        return self._model

    def rerank(
        self,
        query: str,
        documents: Sequence[str],
        top_k: Optional[int] = None,
        min_score: Optional[float] = None,
    ) -> list[RerankResult]:
        """
        Rerank documents by relevance to the query.

        Args:
            query: The user's search query
            documents: List of document texts to rerank
            top_k: Maximum number of results to return (None = all)
            min_score: Minimum relevance score threshold (None = no filtering)

        Returns:
            List of RerankResult sorted by score (descending),
            filtered by top_k and min_score.
        """
        if not documents:
            return []

        api_results = self._rerank_via_api(query, documents, top_k, min_score)
        if api_results is not None:
            return api_results

        # Build (query, document) pairs for the cross-encoder
        pairs = [(query, doc) for doc in documents]

        # Score all pairs in a single batch
        scores = self.model.predict(pairs, batch_size=32).tolist()

        # Build results with original indices
        results = [
            RerankResult(index=i, score=s, text=doc)
            for i, (s, doc) in enumerate(zip(scores, documents))
        ]

        # Sort by score descending (most relevant first)
        results.sort(key=lambda r: r.score, reverse=True)

        # Apply min_score filter
        if min_score is not None:
            results = [r for r in results if r.score >= min_score]

        # Apply top_k limit
        if top_k is not None:
            results = results[:top_k]

        return results


# Singleton instance
_default_service: Optional[RerankerService] = None


def get_reranker_service() -> RerankerService:
    """Get or create the default reranker service."""
    global _default_service
    if _default_service is None:
        _default_service = RerankerService()
    return _default_service
