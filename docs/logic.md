# Logic hệ thống CuongRAG

Tài liệu mô tả luồng xử lý nghiệp vụ chính của dự án.

## 1) Luồng tổng quan

```text
User -> Frontend -> RAG API
                  -> Ingestion API (xử lý tài liệu)
                  -> KG API (khai thác đồ thị tri thức)
                              |
                           PostgreSQL/pgvector
```

## 2) Logic quản lý workspace

- Workspace là đơn vị tách dữ liệu theo miền tri thức.
- CRUD workspace qua `rag-service` (`/api/v1/workspaces`).
- Mỗi workspace có thể có cấu hình:
  - `system_prompt`
  - `kg_language`
  - `kg_entity_types`

## 3) Logic upload + xử lý tài liệu

### 3.1 Upload
- Frontend gọi `POST /api/v1/documents/upload/{workspace_id}`.
- Backend kiểm tra extension (`pdf/txt/md/docx/pptx`) + size tối đa 50MB.
- File lưu vào `uploads/`, tạo bản ghi Document ở trạng thái `PENDING`.

### 3.2 Process
- Frontend gọi `POST /api/v1/rag/process/{document_id}`.
- Backend chuyển trạng thái sang `PROCESSING`.
- Tạo tác vụ nền xử lý tuần tự:
  1. Parse tài liệu (MinerU/Docling)
  2. Chuẩn hóa markdown
  3. Chunking
  4. Embedding + indexing vector
  5. (tuỳ cấu hình) cập nhật KG
- Kết quả:
  - thành công: `INDEXED`
  - lỗi: `FAILED` + `error_message`

### 3.3 Batch
- `POST /api/v1/rag/process-batch` xử lý nhiều document.
- Service chạy nền để tránh block request.

## 4) Logic Chat RAG

### 4.1 Non-stream
- Endpoint: `POST /api/v1/rag/chat/{workspace_id}`
- Các bước:
  1. Retrieve chunks theo query
  2. (tuỳ mode) kết hợp ngữ cảnh KG
  3. Prompting với system prompt cứng + prompt workspace
  4. Gọi LLM (Ollama/Gemini)
  5. Trả về answer + sources + image refs

### 4.2 Stream (SSE)
- Endpoint: `POST /api/v1/rag/chat/{workspace_id}/stream`
- Event chính:
  - `token`: token từng phần
  - `sources`: trích nguồn
  - `complete`: kết thúc
- Frontend cập nhật bubble assistant theo từng token.

### 4.3 Chat history
- Lưu theo `workspace_id` trong bảng `chat_messages`.
- API:
  - `GET /api/v1/rag/chat/{workspace_id}/history`
  - `DELETE /api/v1/rag/chat/{workspace_id}/history`

## 5) Logic Knowledge Graph

- KG dùng dữ liệu markdown đã index.
- `kg-service` cung cấp:
  - entities
  - relationships
  - graph data
  - analytics
  - build KG lại theo workspace
- Endpoint build:
  - `POST /api/v1/kg/build/{workspace_id}`

## 6) Logic phục hồi trạng thái treo

Khi service startup:
- tự động tìm document bị treo ở trạng thái:
  - `PROCESSING`, `PARSING`, `INDEXING`
- nếu quá timeout (`CUONGRAG_PROCESSING_TIMEOUT_MINUTES`) sẽ đánh dấu `FAILED`.

## 7) Logic dữ liệu ảnh trong tài liệu

- Ảnh được lưu theo workspace trong thư mục doc images.
- API markdown có cơ chế fallback inject ảnh từ DB nếu placeholder `<!-- image -->` còn sót.
- Static image mount tại:
  - `/static/doc-images/...`

## 8) Trạng thái Document

- `PENDING`
- `PROCESSING`
- `PARSING`
- `INDEXING`
- `INDEXED`
- `FAILED`

Đây là nguồn trạng thái hiển thị ở trang Documents và analytics.
