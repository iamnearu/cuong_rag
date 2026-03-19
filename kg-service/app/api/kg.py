from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db
from app.core.exceptions import NotFoundError
from app.models.document import Document, DocumentStatus
from app.models.knowledge_base import KnowledgeBase
from app.services.knowledge_graph_service import KnowledgeGraphService

router = APIRouter(prefix="/kg", tags=["knowledge-graph"])


async def _get_workspace(workspace_id: int, db: AsyncSession) -> KnowledgeBase:
    result = await db.execute(select(KnowledgeBase).where(KnowledgeBase.id == workspace_id))
    kb = result.scalar_one_or_none()
    if kb is None:
        raise NotFoundError("KnowledgeBase", workspace_id)
    return kb


@router.get("/entities/{workspace_id}")
async def list_entities(
    workspace_id: int,
    search: str | None = None,
    entity_type: str | None = None,
    limit: int = 200,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    await _get_workspace(workspace_id, db)
    kg = KnowledgeGraphService(workspace_id)
    return await kg.get_entities(search=search, entity_type=entity_type, limit=limit, offset=offset)


@router.get("/relationships/{workspace_id}")
async def list_relationships(
    workspace_id: int,
    entity_name: str | None = None,
    limit: int = 500,
    db: AsyncSession = Depends(get_db),
):
    await _get_workspace(workspace_id, db)
    kg = KnowledgeGraphService(workspace_id)
    return await kg.get_relationships(entity_name=entity_name, limit=limit)


@router.get("/graph/{workspace_id}")
async def graph_data(workspace_id: int, max_nodes: int = 250, db: AsyncSession = Depends(get_db)):
    await _get_workspace(workspace_id, db)
    kg = KnowledgeGraphService(workspace_id)
    return await kg.get_graph_data(max_nodes=max_nodes)


@router.get("/analytics/{workspace_id}")
async def graph_analytics(workspace_id: int, db: AsyncSession = Depends(get_db)):
    await _get_workspace(workspace_id, db)
    kg = KnowledgeGraphService(workspace_id)
    return await kg.get_analytics()


@router.post("/build/{workspace_id}")
async def build_kg(workspace_id: int, db: AsyncSession = Depends(get_db)):
    await _get_workspace(workspace_id, db)

    result = await db.execute(
        select(Document)
        .where(
            Document.workspace_id == workspace_id,
            Document.status == DocumentStatus.INDEXED,
            Document.markdown_content.is_not(None),
        )
        .order_by(Document.id)
    )
    docs = result.scalars().all()

    kg = KnowledgeGraphService(workspace_id)
    kg.delete_project_data()

    ingested = 0
    for doc in docs:
        if (doc.markdown_content or "").strip():
            await kg.ingest(doc.markdown_content)
            ingested += 1

    return {
        "workspace_id": workspace_id,
        "documents_indexed": len(docs),
        "documents_ingested": ingested,
        "message": "KG build completed",
    }
