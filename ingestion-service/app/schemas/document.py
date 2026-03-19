from pydantic import BaseModel
from datetime import datetime
from typing import Any, Literal
from app.models.document import DocumentStatus


class DocumentBase(BaseModel):
    filename: str
    original_filename: str
    file_type: str
    file_size: int


class DocumentCreate(DocumentBase):
    workspace_id: int


class DocumentResponse(DocumentBase):
    id: int
    workspace_id: int
    status: DocumentStatus
    chunk_count: int
    error_message: str | None
    created_at: datetime
    updated_at: datetime
    # CuongRAG fields
    page_count: int = 0
    image_count: int = 0
    table_count: int = 0
    parser_version: str | None = None
    processing_time_ms: int = 0

    model_config = {"from_attributes": True}


class DocumentUploadResponse(BaseModel):
    id: int
    filename: str
    status: DocumentStatus
    message: str


class OCRHeadingBlock(BaseModel):
    type: Literal["heading"] = "heading"
    level: int
    text: str


class OCRParagraphBlock(BaseModel):
    type: Literal["paragraph"] = "paragraph"
    text: str


class OCRTableBlock(BaseModel):
    type: Literal["table"] = "table"
    table_id: str
    rows: list[list[str]]


class OCRImageBlock(BaseModel):
    type: Literal["image"] = "image"
    image_url: str
    caption: str = ""


class OCRContentPage(BaseModel):
    page_number: int
    blocks: list[OCRHeadingBlock | OCRParagraphBlock | OCRTableBlock | OCRImageBlock | dict[str, Any]]


class OCRDocumentMetadata(BaseModel):
    source_filename: str
    total_pages: int
    processed_at: datetime
    parser_version: str | None = None


class OCRDocumentBody(BaseModel):
    metadata: OCRDocumentMetadata
    content: list[OCRContentPage]


class DocumentOCRStructuredResponse(BaseModel):
    document_id: int
    status: DocumentStatus
    num_pages: int
    markdown_available: bool
    document: OCRDocumentBody | None = None
