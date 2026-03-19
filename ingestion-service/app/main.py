"""
CuongRAG — Ingestion Service
Handles: document upload, parsing (MinerU/Docling), chunking, embedding, dedup, indexing
"""
from contextlib import asynccontextmanager
import logging
import os
from datetime import datetime, timedelta

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text, update

from app.core.config import settings
from app.core.database import engine, Base

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting CuongRAG Ingestion Service...")

    if os.environ.get("AUTO_CREATE_TABLES", "true").lower() == "true":
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            await conn.execute(text(
                "ALTER TABLE knowledge_bases ADD COLUMN IF NOT EXISTS system_prompt TEXT"
            ))
            await conn.execute(text(
                "ALTER TABLE knowledge_bases ADD COLUMN IF NOT EXISTS kg_language VARCHAR(50)"
            ))
            await conn.execute(text(
                "ALTER TABLE knowledge_bases ADD COLUMN IF NOT EXISTS kg_entity_types JSON"
            ))
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
                logger.warning(f"Recovered {len(stale_ids)} stale docs: {stale_ids}")
    else:
        logger.info("AUTO_CREATE_TABLES=false — skipping migrations")

    yield
    logger.info("CuongRAG Ingestion Service shutting down...")
    await engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    description="CuongRAG — Ingestion Service (upload + parse + chunk + index)",
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
    return {"status": "healthy", "service": "ingestion-service"}


@app.get("/ready")
async def ready():
    return {"status": "ready", "service": "ingestion-service"}


# API routes
from app.api.router import api_router  # noqa: E402
app.include_router(api_router, prefix="/api/v1")

# Register SQLAlchemy models
from app.models import knowledge_base, document  # noqa: E402, F401
