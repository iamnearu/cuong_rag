"""PostgreSQL pgvector Vector Store Service.

Stores and queries embeddings directly in PostgreSQL using pgvector.
"""
from __future__ import annotations

import json
import logging
import threading
from typing import Sequence, Optional

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

from app.core.config import settings

logger = logging.getLogger(__name__)

_engine: Optional[Engine] = None
_lock = threading.Lock()


def _sync_database_url() -> str:
    """Convert async SQLAlchemy URL to sync psycopg2 URL."""
    url = settings.DATABASE_URL
    if "+asyncpg" in url:
        return url.replace("+asyncpg", "+psycopg2")
    return url


def _get_engine() -> Engine:
    global _engine
    with _lock:
        if _engine is None:
            _engine = create_engine(
                _sync_database_url(),
                pool_pre_ping=True,
                future=True,
            )
            with _engine.begin() as conn:
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS vector_chunks (
                        workspace_id INTEGER NOT NULL,
                        chunk_id TEXT NOT NULL,
                        document TEXT NOT NULL,
                        embedding vector NOT NULL,
                        metadata_json JSONB,
                        document_id INTEGER,
                        PRIMARY KEY (workspace_id, chunk_id)
                    )
                """))
                conn.execute(text(
                    "CREATE INDEX IF NOT EXISTS ix_vector_chunks_workspace ON vector_chunks(workspace_id)"
                ))
                conn.execute(text(
                    "CREATE INDEX IF NOT EXISTS ix_vector_chunks_document_id ON vector_chunks(document_id)"
                ))
            logger.info("Initialized pgvector table in PostgreSQL")
    return _engine


def _to_vector_literal(values: list[float]) -> str:
    return "[" + ",".join(str(float(v)) for v in values) + "]"


class VectorStore:
    """Vector store service with workspace-level isolation."""

    def __init__(self, workspace_id: int):
        self.workspace_id = workspace_id

    def add_documents(
        self,
        ids: Sequence[str],
        embeddings: Sequence[list[float]],
        documents: Sequence[str],
        metadatas: Sequence[dict] | None = None,
    ) -> None:
        if not ids:
            return

        engine = _get_engine()
        rows = []
        for i, chunk_id in enumerate(ids):
            metadata = metadatas[i] if metadatas and i < len(metadatas) else {}
            rows.append(
                (
                    self.workspace_id,
                    str(chunk_id),
                    documents[i],
                    _to_vector_literal(embeddings[i]),
                    json.dumps(metadata or {}, ensure_ascii=False),
                    (metadata or {}).get("document_id"),
                )
            )

        stmt = text("""
            INSERT INTO vector_chunks
            (workspace_id, chunk_id, document, embedding, metadata_json, document_id)
            VALUES
            (:workspace_id, :chunk_id, :document, CAST(:embedding AS vector), CAST(:metadata_json AS jsonb), :document_id)
            ON CONFLICT (workspace_id, chunk_id)
            DO UPDATE SET
                document = EXCLUDED.document,
                embedding = EXCLUDED.embedding,
                metadata_json = EXCLUDED.metadata_json,
                document_id = EXCLUDED.document_id
        """)

        payload = [
            {
                "workspace_id": r[0],
                "chunk_id": r[1],
                "document": r[2],
                "embedding": r[3],
                "metadata_json": r[4],
                "document_id": r[5],
            }
            for r in rows
        ]
        with engine.begin() as conn:
            conn.execute(stmt, payload)

        logger.info("Added %s vectors for workspace %s", len(rows), self.workspace_id)

    def query(
        self,
        query_embedding: list[float],
        n_results: int = 5,
        where: dict | None = None,
        include: list[str] | None = None,
    ) -> dict:
        _ = include
        engine = _get_engine()

        params: dict = {
            "workspace_id": self.workspace_id,
            "query_embedding": _to_vector_literal(query_embedding),
            "n_results": int(max(0, n_results)),
        }
        where_sql = ""

        if where and "document_id" in where:
            doc_filter = where["document_id"]
            if isinstance(doc_filter, dict) and "$in" in doc_filter and doc_filter["$in"]:
                placeholders = []
                for i, doc_id in enumerate(doc_filter["$in"]):
                    key = f"doc_id_{i}"
                    params[key] = int(doc_id)
                    placeholders.append(f":{key}")
                where_sql = f" AND document_id IN ({', '.join(placeholders)})"
            elif isinstance(doc_filter, int):
                params["single_doc_id"] = int(doc_filter)
                where_sql = " AND document_id = :single_doc_id"

        stmt = text(f"""
            SELECT
                chunk_id,
                document,
                metadata_json,
                (embedding <=> CAST(:query_embedding AS vector)) AS distance
            FROM vector_chunks
            WHERE workspace_id = :workspace_id
            {where_sql}
            ORDER BY embedding <=> CAST(:query_embedding AS vector)
            LIMIT :n_results
        """)

        try:
            with engine.begin() as conn:
                rows = conn.execute(stmt, params).fetchall()
        except Exception as e:
            if "different vector dimensions" in str(e).lower():
                logger.warning("Vector dimension mismatch during query: %s", e)
                return {"ids": [], "documents": [], "metadatas": [], "distances": []}
            raise

        return {
            "ids": [r[0] for r in rows],
            "documents": [r[1] for r in rows],
            "metadatas": [r[2] if isinstance(r[2], dict) else (json.loads(r[2]) if r[2] else {}) for r in rows],
            "distances": [float(r[3]) for r in rows],
        }

    def delete_by_document_id(self, document_id: int) -> None:
        engine = _get_engine()
        with engine.begin() as conn:
            conn.execute(
                text("DELETE FROM vector_chunks WHERE workspace_id = :workspace_id AND document_id = :document_id"),
                {"workspace_id": self.workspace_id, "document_id": document_id},
            )

    def delete_collection(self) -> None:
        engine = _get_engine()
        with engine.begin() as conn:
            conn.execute(
                text("DELETE FROM vector_chunks WHERE workspace_id = :workspace_id"),
                {"workspace_id": self.workspace_id},
            )

    def count(self) -> int:
        engine = _get_engine()
        with engine.begin() as conn:
            row = conn.execute(
                text("SELECT COUNT(*) FROM vector_chunks WHERE workspace_id = :workspace_id"),
                {"workspace_id": self.workspace_id},
            ).fetchone()
        return int(row[0] if row else 0)

    def get_by_ids(self, ids: Sequence[str]) -> dict:
        if not ids:
            return {"ids": [], "documents": [], "metadatas": []}

        engine = _get_engine()
        params = {"workspace_id": self.workspace_id}
        placeholders = []
        for i, chunk_id in enumerate(ids):
            k = f"chunk_id_{i}"
            params[k] = str(chunk_id)
            placeholders.append(f":{k}")

        stmt = text(
            "SELECT chunk_id, document, metadata_json FROM vector_chunks "
            f"WHERE workspace_id = :workspace_id AND chunk_id IN ({', '.join(placeholders)})"
        )
        with engine.begin() as conn:
            rows = conn.execute(stmt, params).fetchall()
        return {
            "ids": [r[0] for r in rows],
            "documents": [r[1] for r in rows],
            "metadatas": [r[2] if isinstance(r[2], dict) else (json.loads(r[2]) if r[2] else {}) for r in rows],
        }


def get_vector_store(workspace_id: int) -> VectorStore:
    return VectorStore(workspace_id)
