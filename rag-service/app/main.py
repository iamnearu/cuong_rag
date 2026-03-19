"""
CuongRAG — RAG Service
Handles: workspaces, chat, query, knowledge graph endpoints
"""
from contextlib import asynccontextmanager
from pathlib import Path
import logging
import os
from datetime import datetime, timedelta

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text, update

from app.core.config import settings
from app.core.database import engine, Base

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting CuongRAG RAG Service...")

    if os.environ.get("AUTO_CREATE_TABLES", "true").lower() == "true":
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

            # Migrations idempotentes
            migrations = [
                "ALTER TABLE knowledge_bases ADD COLUMN IF NOT EXISTS system_prompt TEXT",
                "ALTER TABLE knowledge_bases ADD COLUMN IF NOT EXISTS kg_language VARCHAR(50)",
                "ALTER TABLE knowledge_bases ADD COLUMN IF NOT EXISTS kg_entity_types JSON",
                """
                CREATE TABLE IF NOT EXISTS chat_messages (
                    id SERIAL PRIMARY KEY,
                    workspace_id INTEGER NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
                    message_id VARCHAR(50) NOT NULL,
                    role VARCHAR(20) NOT NULL,
                    content TEXT NOT NULL,
                    sources JSON,
                    related_entities JSON,
                    image_refs JSON,
                    thinking TEXT,
                    ratings JSON,
                    agent_steps JSON,
                    created_at TIMESTAMP DEFAULT NOW()
                )
                """,
                "CREATE INDEX IF NOT EXISTS ix_chat_messages_workspace_id ON chat_messages(workspace_id)",
                "CREATE INDEX IF NOT EXISTS ix_chat_messages_message_id ON chat_messages(message_id)",
            ]
            for stmt in migrations:
                await conn.execute(text(stmt))

        logger.info("Database tables created/verified")

        # Recover stale processing documents
        from app.models.document import Document, DocumentStatus
        from sqlalchemy.ext.asyncio import AsyncSession
        async with AsyncSession(engine) as session:
            timeout = settings.CUONGRAG_PROCESSING_TIMEOUT_MINUTES
            cutoff = datetime.utcnow() - timedelta(minutes=timeout)
            result = await session.execute(
                update(Document)
                .where(
                    Document.status.in_([
                        DocumentStatus.PROCESSING,
                        DocumentStatus.PARSING,
                        DocumentStatus.INDEXING,
                    ]),
                    Document.updated_at < cutoff,
                )
                .values(
                    status=DocumentStatus.FAILED,
                    error_message=f"Processing timeout ({timeout}min). Click Analyze to retry.",
                )
                .returning(Document.id)
            )
            stale_ids = [row[0] for row in result.fetchall()]
            if stale_ids:
                await session.commit()
                logger.warning(f"Recovered {len(stale_ids)} stale documents: {stale_ids}")
    else:
        logger.info("AUTO_CREATE_TABLES=false — skipping migrations")

    yield
    logger.info("CuongRAG RAG Service shutting down...")
    await engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    description="CuongRAG — Knowledge Base RAG Service (workspaces + query + chat)",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    redirect_slashes=False,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "rag-service"}


@app.get("/ready")
async def ready():
    return {"status": "ready", "service": "rag-service"}


# API routes
from app.api.router_v2 import api_router  # noqa: E402
app.include_router(api_router, prefix="/api/v1")

# Static files — document images (Docling)
_docling_data = Path(__file__).resolve().parent.parent / "data" / "docling"
_docling_data.mkdir(parents=True, exist_ok=True)
app.mount("/static/doc-images", StaticFiles(directory=str(_docling_data)), name="static_doc_images")

# Register SQLAlchemy models
from app.models import knowledge_base, document, chat_message  # noqa: E402, F401
