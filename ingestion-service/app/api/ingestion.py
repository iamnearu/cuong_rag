from __future__ import annotations

import asyncio
import logging
import os
import time
import uuid
from pathlib import Path

import aiofiles
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_db
from app.core.exceptions import NotFoundError
from app.models.document import Document, DocumentStatus
from app.models.knowledge_base import KnowledgeBase
from app.schemas.document import DocumentUploadResponse
from app.schemas.rag import BatchProcessRequest, DocumentProcessResponse
from app.services.rag_service import get_rag_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ingest", tags=["ingestion"])

UPLOAD_DIR = settings.BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_EXTENSIONS = {".pdf", ".txt", ".md", ".docx", ".pptx"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB


async def _process_document_background(document_id: int, file_path: str, workspace_id: int):
    """Background task to process a single document."""
    from app.core.database import async_session_maker

    async with async_session_maker() as db:
        try:
            rag_service = get_rag_service(db, workspace_id)
            await rag_service.process_document(document_id, file_path)
            logger.info(f"Document {document_id} processed successfully")
        except Exception as exc:
            logger.error(f"Failed to process document {document_id}: {exc}")
            result = await db.execute(select(Document).where(Document.id == document_id))
            doc = result.scalar_one_or_none()
            if doc is not None:
                doc.status = DocumentStatus.FAILED
                doc.error_message = str(exc)[:500]
                await db.commit()


async def _resolve_workspace(
    db: AsyncSession,
    workspace_id: int | None,
    workspace_name: str | None,
    auto_create_workspace: bool,
) -> KnowledgeBase:
    if workspace_id is not None:
        result = await db.execute(select(KnowledgeBase).where(KnowledgeBase.id == workspace_id))
        kb = result.scalar_one_or_none()
        if kb is None:
            raise NotFoundError("KnowledgeBase", workspace_id)
        return kb

    normalized_name = (workspace_name or "").strip()
    if not normalized_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide workspace_id or workspace_name",
        )

    result = await db.execute(select(KnowledgeBase).where(KnowledgeBase.name == normalized_name))
    kb = result.scalar_one_or_none()
    if kb is not None:
        return kb

    if not auto_create_workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workspace '{normalized_name}' not found",
        )

    kb = KnowledgeBase(name=normalized_name)
    db.add(kb)
    await db.commit()
    await db.refresh(kb)
    return kb


@router.post("/upload/{workspace_id}", response_model=DocumentUploadResponse)
async def upload_document(
    workspace_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(KnowledgeBase).where(KnowledgeBase.id == workspace_id))
    kb = result.scalar_one_or_none()
    if kb is None:
        raise NotFoundError("KnowledgeBase", workspace_id)

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type {ext} not allowed. Allowed: {ALLOWED_EXTENSIONS}",
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Max size: {MAX_FILE_SIZE // 1024 // 1024}MB",
        )

    filename = f"{uuid.uuid4()}{ext}"
    file_path = UPLOAD_DIR / filename

    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    document = Document(
        workspace_id=workspace_id,
        filename=filename,
        original_filename=file.filename,
        file_type=ext[1:],
        file_size=len(content),
        status=DocumentStatus.PENDING,
    )
    db.add(document)
    await db.commit()
    await db.refresh(document)

    return DocumentUploadResponse(
        id=document.id,
        filename=document.original_filename,
        status=document.status,
        message="Uploaded. Call process endpoint to start indexing.",
    )


@router.post("/easy-index")
async def easy_index_document(
    file: UploadFile = File(...),
    workspace_id: int | None = Form(default=None),
    workspace_name: str | None = Form(default="test-deepseek"),
    auto_create_workspace: bool = Form(default=True),
    wait_for_index: bool = Form(default=True),
    timeout_seconds: int = Form(default=180),
    poll_interval_seconds: float = Form(default=2.0),
    db: AsyncSession = Depends(get_db),
):
    """One-shot test endpoint: resolve workspace, upload, process, and optionally wait."""
    if timeout_seconds < 10:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="timeout_seconds must be >= 10",
        )
    if poll_interval_seconds <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="poll_interval_seconds must be > 0",
        )

    kb = await _resolve_workspace(db, workspace_id, workspace_name, auto_create_workspace)

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type {ext} not allowed. Allowed: {ALLOWED_EXTENSIONS}",
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Max size: {MAX_FILE_SIZE // 1024 // 1024}MB",
        )

    filename = f"{uuid.uuid4()}{ext}"
    file_path = UPLOAD_DIR / filename

    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    document = Document(
        workspace_id=kb.id,
        filename=filename,
        original_filename=file.filename,
        file_type=ext[1:],
        file_size=len(content),
        status=DocumentStatus.PENDING,
    )
    db.add(document)
    await db.commit()
    await db.refresh(document)

    document.status = DocumentStatus.PROCESSING
    document.error_message = None
    await db.commit()

    asyncio.create_task(
        _process_document_background(document.id, str(file_path), document.workspace_id)
    )

    if not wait_for_index:
        return {
            "workspace_id": kb.id,
            "workspace_name": kb.name,
            "document_id": document.id,
            "filename": document.original_filename,
            "status": DocumentStatus.PROCESSING.value,
            "message": "Upload and indexing started",
        }

    start = time.monotonic()
    while time.monotonic() - start <= timeout_seconds:
        result = await db.execute(select(Document).where(Document.id == document.id))
        latest = result.scalar_one_or_none()
        if latest is None:
            raise NotFoundError("Document", document.id)

        if latest.status in (DocumentStatus.INDEXED, DocumentStatus.FAILED):
            return {
                "workspace_id": kb.id,
                "workspace_name": kb.name,
                "document_id": latest.id,
                "filename": latest.original_filename,
                "status": latest.status.value,
                "chunk_count": latest.chunk_count,
                "error_message": latest.error_message,
            }

        await asyncio.sleep(poll_interval_seconds)

    result = await db.execute(select(Document).where(Document.id == document.id))
    latest = result.scalar_one_or_none()
    return {
        "workspace_id": kb.id,
        "workspace_name": kb.name,
        "document_id": document.id,
        "filename": document.original_filename,
        "status": latest.status.value if latest else DocumentStatus.PROCESSING.value,
        "message": f"Timeout after {timeout_seconds}s. Poll /api/v1/ingest/status/{document.id}",
    }


@router.post("/process/{document_id}", response_model=DocumentProcessResponse)
async def process_document(document_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Document).where(Document.id == document_id))
    document = result.scalar_one_or_none()

    if document is None:
        raise NotFoundError("Document", document_id)

    if document.status in (DocumentStatus.PROCESSING, DocumentStatus.PARSING, DocumentStatus.INDEXING):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Document is already being processed",
        )

    if document.status == DocumentStatus.INDEXED:
        return DocumentProcessResponse(
            document_id=document.id,
            status=document.status.value,
            chunk_count=document.chunk_count,
            message="Document already indexed",
        )

    file_path = UPLOAD_DIR / document.filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Document file not found")

    document.status = DocumentStatus.PROCESSING
    document.error_message = None
    await db.commit()

    asyncio.create_task(
        _process_document_background(document.id, str(file_path), document.workspace_id)
    )

    return DocumentProcessResponse(
        document_id=document.id,
        status=DocumentStatus.PROCESSING.value,
        chunk_count=0,
        message="Processing started",
    )


@router.post("/batch")
async def process_batch(request: BatchProcessRequest, db: AsyncSession = Depends(get_db)):
    accepted: list[int] = []
    skipped: list[int] = []

    items: list[tuple[int, str, int]] = []
    for doc_id in request.document_ids:
        result = await db.execute(select(Document).where(Document.id == doc_id))
        doc = result.scalar_one_or_none()
        if doc is None:
            skipped.append(doc_id)
            continue

        if doc.status in (DocumentStatus.PROCESSING, DocumentStatus.PARSING, DocumentStatus.INDEXING):
            skipped.append(doc_id)
            continue

        file_path = UPLOAD_DIR / doc.filename
        if not file_path.exists():
            skipped.append(doc_id)
            continue

        doc.status = DocumentStatus.PROCESSING
        doc.error_message = None
        accepted.append(doc.id)
        items.append((doc.id, str(file_path), doc.workspace_id))

    await db.commit()

    async def _worker():
        for did, fp, wsid in items:
            await _process_document_background(did, fp, wsid)

    if items:
        asyncio.create_task(_worker())

    return {
        "message": f"Processing {len(accepted)} document(s)",
        "accepted": accepted,
        "skipped": skipped,
    }


@router.get("/status/{document_id}")
async def get_document_status(document_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Document).where(Document.id == document_id))
    document = result.scalar_one_or_none()
    if document is None:
        raise NotFoundError("Document", document_id)

    return {
        "id": document.id,
        "workspace_id": document.workspace_id,
        "filename": document.original_filename,
        "status": document.status.value,
        "chunk_count": document.chunk_count,
        "error_message": document.error_message,
        "updated_at": document.updated_at,
    }


@router.post("/reindex/{document_id}", response_model=DocumentProcessResponse)
async def reindex_document(document_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Document).where(Document.id == document_id))
    document = result.scalar_one_or_none()
    if document is None:
        raise NotFoundError("Document", document_id)

    file_path = UPLOAD_DIR / document.filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Document file not found")

    rag_service = get_rag_service(db, document.workspace_id)

    try:
        await rag_service.delete_document(document.id)
    except Exception as exc:
        logger.warning(f"Delete old chunks before reindex failed: {exc}")

    document.status = DocumentStatus.PENDING
    document.chunk_count = 0
    document.error_message = None
    await db.commit()

    chunk_count = await rag_service.process_document(document.id, str(file_path))

    return DocumentProcessResponse(
        document_id=document.id,
        status=DocumentStatus.INDEXED.value,
        chunk_count=chunk_count,
        message="Re-indexed successfully",
    )


@router.delete("/document/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(document_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Document).where(Document.id == document_id))
    document = result.scalar_one_or_none()
    if document is None:
        raise NotFoundError("Document", document_id)

    if document.status == DocumentStatus.INDEXED:
        try:
            rag_service = get_rag_service(db, document.workspace_id)
            await rag_service.delete_document(document.id)
        except Exception as exc:
            logger.warning(f"Failed to delete vectors for document {document.id}: {exc}")

    file_path = UPLOAD_DIR / document.filename
    if file_path.exists():
        os.remove(file_path)

    await db.delete(document)
    await db.commit()
