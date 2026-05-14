# Tổng quan code CuongRAG

Mục tiêu: File này giải thích logic hệ thống trước, sau đó map nhanh vai trò các file quan trọng để dễ tìm code.

---

## 1) Logic tổng quát (dễ hiểu)

Luôn có 2 pha chính: **ingest tài liệu** và **trả lời câu hỏi**.

**Pha ingest (tài liệu)**

1. User upload file từ frontend.
2. `ingestion-service` nhận file, gọi OCR/Docling/MinerU -> ra markdown + hình + bảng.
3. (Tùy chọn) ProtonX sửa dấu tiếng Việt trên markdown.
4. Chia nhỏ (chunk) -> embed -> lưu vector vào DB (pgvector).
5. Song song, đưa markdown sang KG service để trích xuất thực thể/quan hệ (LightRAG).

**Pha hỏi đáp (chat)**

1. User đặt câu hỏi từ frontend.
2. `rag-service` (hoặc `ingestion-service` trong một số route) embed câu hỏi.
3. Truy vấn vector DB lấy top-N chunk -> rerank -> chọn top-K.
4. Nếu KG bật, lấy thêm KG context (không rerank).
5. Build prompt -> gọi LLM -> stream trả lời + citation.

---

## 2) Các service và vai trò

- **frontend/**: UI web (React). Upload, chat, hiện citation, xem tài liệu.
- **ingestion-service/**: Xử lý tài liệu (OCR, làm sạch, chunk, embed, index, KG ingest).
- **rag-service/**: Dịch vụ chat/RAG (truy vấn vector + KG, rerank, gọi LLM).
- **kg-service/**: LightRAG (Knowledge Graph) đọc/lưu KG, query KG.
- **OCR-SERVICE/**: Hệ OCR riêng (worker/consumer). Có thể được dùng bổ trợ.

---

## 3) Bản đồ file (theo service)

### A) ingestion-service/

**App entry**
- `app/main.py`: khởi tạo FastAPI, router, middleware.

**API layer** (HTTP endpoints)
- `app/api/ingestion.py`: upload/ingest file, trigger process.
- `app/api/documents.py`: CRUD document, status, markdown.
- `app/api/rag.py`: endpoint RAG (chat/query) cho ingestion-service.
- `app/api/workspaces.py`: quản lý workspace (knowledge base).
- `app/api/chat_agent.py`: chat agent/stream.
- `app/api/config.py`: expose config (nếu cần).
- `app/api/router.py`: gom router.

**Core**
- `app/core/config.py`: tất cả config/env (OCR, chunk, KG, embed, rerank).
- `app/core/database.py`: kết nối DB.
- `app/core/deps.py`: dependency injection cho FastAPI.
- `app/core/exceptions.py`: exception chung.

**Models (DB)**
- `app/models/document.py`: bảng document.
- `app/models/knowledge_base.py`: bảng workspace.
- `app/models/chat_message.py`: lịch sử chat.

**Schemas (Pydantic)**
- `app/schemas/document.py`: schema cho document.
- `app/schemas/workspace.py`: schema cho workspace.
- `app/schemas/rag.py`: schema cho query/chat.

**Services (logic chính)**
- `app/services/cuong_rag_service.py`: pipeline đầy đủ (parse -> index -> KG ingest).
- `app/services/deep_document_parser.py`: OCR/Docling/MinerU -> markdown, hình, bảng.
- `app/services/chunker.py`: chia đoạn text (recursive splitter + overlap).
- `app/services/chunk_dedup.py`: loại chunk trùng/nhiễu.
- `app/services/embedder.py`: tạo embedding (local/API).
- `app/services/vector_store.py`: lưu vector vào PostgreSQL + pgvector.
- `app/services/knowledge_graph_service.py`: LightRAG KG ingest/query.
- `app/services/deep_retriever.py`: hybrid retriever (vector + KG + rerank).
- `app/services/reranker.py`: cross-encoder rerank.
- `app/services/document_loader.py`: load file text (txt/md/pdf).
- `app/services/rag_service.py`: legacy pipeline (khi tắt CuongRAG).
- `app/services/llm/`: provider LLM (gemini/ollama/...)
- `app/services/ocr/`: OCR parser (docling/mineru/...).
- `app/services/models/`: model trung gian (ParsedDocument, EnrichedChunk,...)

---

### B) rag-service/

**App entry**
- `app/main.py`: khởi tạo FastAPI cho service chat.

**API layer**
- `app/api/rag.py`: endpoint chat/stream, query.
- `app/api/documents.py`: thông tin document cho UI.
- `app/api/workspaces.py`: workspace management.
- `app/api/chat_agent.py`: chat agent.
- `app/api/config.py`: expose config (nếu cần).
- `app/api/router.py`, `app/api/router_v2.py`: gom router.

**Core/Models/Schemas**
- Cấu trúc giống ingestion-service, để giữ API đồng nhất.

**Services**
- `app/services/deep_retriever.py`: hybrid retrieval (vector + KG + rerank).
- `app/services/vector_store.py`: truy vấn pgvector.
- `app/services/knowledge_graph_service.py`: LightRAG KG query.
- `app/services/reranker.py`, `embedder.py`, `chunker.py`: tiến trình truy vấn.

---

### C) kg-service/

**App entry**
- `app/main.py`: FastAPI.

**API layer**
- `app/api/kg.py`: endpoint KG (query, graph data, rebuild, ...).
- `app/api/rag.py`, `app/api/documents.py`, `app/api/workspaces.py`: endpoints phụ trợ.

**Services**
- `app/services/knowledge_graph_service.py`: LightRAG core (ingest/query).

---

### D) OCR-SERVICE/

**App entry**
- `app/main.py`: khởi tạo API OCR.

**API layer**
- `app/api/routes/ocr.py`: endpoint OCR.

**Services**
- `app/services/ocr_service.py`: xử lý OCR.
- `app/services/document_consumer.py`: consumer queue.
- `app/services/processor.py`: tiến trình xử lý.
- `app/services/rabbitmq_publisher.py`: publish job.

---

### E) frontend/

- `src/main.jsx`: entry React.
- `src/App.jsx`: layout chính.
- `src/pages/*`: các trang UI (Chat, Documents, Analytics, KnowledgeGraph, Workspaces).
- `src/api/client.js`: gọi API backend.
- `src/index.css`: style chung.

---

## 4) File ở top-level

- `docker-compose.yml`: chạy toàn bộ hệ thống.
- `Makefile`: lệnh build/run nhanh.
- `tongquat.md`, `chitiet.md`, `use_case.md`: tài liệu hệ thống.
- `docs/`: tài liệu bổ sung.

---

## 5) Gợi ý cách đọc code

1. Đọc `tongquat.md` để hiểu kiến trúc.
2. Đọc `ingestion-service/app/services/cuong_rag_service.py` để biết pipeline ingest.
3. Đọc `rag-service/app/services/deep_retriever.py` để biết retrieval và rerank.
4. Đọc `ingestion-service/app/services/deep_document_parser.py` để hiểu OCR + ProtonX.
