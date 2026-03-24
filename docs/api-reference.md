# API Reference (tóm tắt)

Base prefix backend: `/api/v1`

> Lưu ý: frontend hiện gọi chủ yếu qua `rag-service` (port `8081`) với các route `/workspaces`, `/documents`, `/rag/*`.

## 1) Health endpoints

- `GET /health`
- `GET /ready`

Có trên cả 3 service (`8081`, `8082`, `8083`).

## 2) Workspace API

### RAG service (`8081`)
- `GET /api/v1/workspaces`
- `POST /api/v1/workspaces`
- `GET /api/v1/workspaces/summary`
- `GET /api/v1/workspaces/{workspace_id}`
- `PUT /api/v1/workspaces/{workspace_id}`
- `DELETE /api/v1/workspaces/{workspace_id}`

### Ingestion service (`8082`)
- Router tương tự cho workspace CRUD.

## 3) Documents API

### RAG service (`8081`)
- `GET /api/v1/documents/workspace/{workspace_id}`
- `POST /api/v1/documents/upload/{workspace_id}`
- `GET /api/v1/documents/{document_id}`
- `GET /api/v1/documents/{document_id}/markdown`
- `GET /api/v1/documents/{document_id}/images`
- `DELETE /api/v1/documents/{document_id}`

### Ingestion service (`8082`)
- Có endpoints documents tương tự, thêm OCR structured:
- `GET /api/v1/documents/{document_id}/ocr-structured`

## 4) RAG/Chat API (RAG service `8081`)

- `POST /api/v1/rag/query/{workspace_id}`
- `POST /api/v1/rag/process/{document_id}`
- `POST /api/v1/rag/process-batch`
- `POST /api/v1/rag/reindex/{document_id}`
- `POST /api/v1/rag/reindex-workspace/{workspace_id}`
- `GET /api/v1/rag/stats/{workspace_id}`
- `GET /api/v1/rag/chunks/{document_id}`
- `GET /api/v1/rag/entities/{workspace_id}`
- `GET /api/v1/rag/relationships/{workspace_id}`
- `GET /api/v1/rag/graph/{workspace_id}`
- `GET /api/v1/rag/analytics/{workspace_id}`
- `GET /api/v1/rag/chat/{workspace_id}/history`
- `DELETE /api/v1/rag/chat/{workspace_id}/history`
- `POST /api/v1/rag/chat/{workspace_id}/rate`
- `POST /api/v1/rag/chat/{workspace_id}/stream` (SSE)
- `POST /api/v1/rag/chat/{workspace_id}`
- `GET /api/v1/rag/capabilities`
- `POST /api/v1/rag/debug-chat/{workspace_id}`

## 5) Ingestion API riêng (`8082`)

Prefix: `/api/v1/ingest`

- `POST /upload/{workspace_id}`
- `POST /easy-index`
- `POST /process/{document_id}`
- `POST /batch`
- `GET /status/{document_id}`
- `POST /reindex/{document_id}`
- `DELETE /document/{document_id}`

## 6) KG API (`8083`)

Prefix: `/api/v1/kg`

- `GET /entities/{workspace_id}`
- `GET /relationships/{workspace_id}`
- `GET /graph/{workspace_id}`
- `GET /analytics/{workspace_id}`
- `POST /build/{workspace_id}`

## 7) Swagger

- RAG: `http://localhost:8081/docs`
- Ingestion: `http://localhost:8082/docs`
- KG: `http://localhost:8083/docs`
