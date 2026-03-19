"""Knowledge graph service router."""
from fastapi import APIRouter

from app.api.kg import router as kg_router

api_router = APIRouter()
api_router.include_router(kg_router)
