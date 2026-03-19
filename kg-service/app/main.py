"""
CuongRAG — KG Service
Handles: Knowledge Graph entities, relationships, graph visualization, analytics
"""
from contextlib import asynccontextmanager
import logging
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.core.config import settings
from app.core.database import engine, Base

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting CuongRAG KG Service...")

    if os.environ.get("AUTO_CREATE_TABLES", "true").lower() == "true":
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables ready")

    yield
    logger.info("CuongRAG KG Service shutting down...")
    await engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    description="CuongRAG — Knowledge Graph Service (entities + relationships + graph)",
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
    return {"status": "healthy", "service": "kg-service"}


@app.get("/ready")
async def ready():
    return {"status": "ready", "service": "kg-service"}


# API routes
from app.api.router import api_router  # noqa: E402
app.include_router(api_router, prefix="/api/v1")

# Register SQLAlchemy models
from app.models import knowledge_base, document  # noqa: E402, F401
