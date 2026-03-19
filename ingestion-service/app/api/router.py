"""Ingestion service router."""
from fastapi import APIRouter

from app.api.documents import router as documents_router
from app.api.ingestion import router as ingestion_router
from app.api.workspaces import router as workspaces_router

api_router = APIRouter()
api_router.include_router(ingestion_router)
api_router.include_router(workspaces_router)
api_router.include_router(documents_router)
