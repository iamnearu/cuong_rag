# CUONGRAG — TỔNG QUAN HỆ THỐNG

> Tài liệu này mô tả toàn bộ hệ thống CuongRAG theo ngôn ngữ đơn giản, có ví dụ cụ thể và truy vết code thực tế.

---

## MỤC LỤC

1. [Hệ thống là gì?](#1-hệ-thống-là-gì)
2. [Kiến trúc tổng thể](#2-kiến-trúc-tổng-thể)
3. [Các service và nhiệm vụ](#3-các-service-và-nhiệm-vụ)
4. [Cách chạy hệ thống](#4-cách-chạy-hệ-thống)
5. [Luồng Upload tài liệu](#5-luồng-upload-tài-liệu)
6. [Luồng Chat — Ví dụ: "A là gì?"](#6-luồng-chat--ví-dụ-a-là-gì)
7. [Cơ sở dữ liệu](#7-cơ-sở-dữ-liệu)
8. [Cấu hình & biến môi trường](#8-cấu-hình--biến-môi-trường)
9. [Lệnh hữu ích](#9-lệnh-hữu-ích)

---

## 1. Hệ thống là gì?

**CuongRAG** là chatbot tra cứu tài liệu. Bạn upload tài liệu PDF/DOCX lên → hệ thống đọc và lưu trữ → sau đó bạn hỏi bất kỳ câu gì liên quan đến tài liệu đó → hệ thống trả lời chính xác kèm trích dẫn nguồn.

**Ví dụ thực tế:**

```
Bạn upload: "Báo cáo tài chính TechVina 2025.pdf"
Bạn hỏi:   "Doanh thu quý 3 của TechVina là bao nhiêu?"
Hệ thống:   "Doanh thu quý 3 năm 2025 của TechVina đạt 450 tỷ đồng [nguồn: trang 12]"
```

**Điểm khác biệt so với ChatGPT thông thường:**
- ChatGPT trả lời từ kiến thức chung, có thể bịa đặt.
- CuongRAG **chỉ trả lời từ tài liệu bạn đã upload**, kèm trích dẫn cụ thể trang nào.

---

## 2. Kiến trúc tổng thể

```
┌─────────────────────────────────────────────────────────┐
│                    NGƯỜI DÙNG                           │
│              (trình duyệt Chrome/Firefox)               │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP
                       ▼
┌─────────────────────────────────────────────────────────┐
│              FRONTEND  (port 3001)                      │
│           React + Vite — Giao diện web                  │
└──────┬──────────────────────────────┬───────────────────┘
       │ Upload file                  │ Câu hỏi chat
       ▼                              ▼
┌──────────────────┐        ┌─────────────────────────────┐
│ INGESTION SERVICE│        │       RAG SERVICE            │
│   (port 8082)    │        │        (port 8081)           │
│                  │        │                              │
│  Xử lý tài liệu │        │  Tìm kiếm + Trả lời         │
│  OCR → Chunk →   │        │  Vector search + KG +        │
│  Embed → Index   │        │  Rerank + LLM stream         │
└────────┬─────────┘        └──────────┬──────────────────┘
         │                             │
         │        ┌────────────────────┘
         │        │
         ▼        ▼
┌─────────────────────────────────────────────────────────┐
│         KG SERVICE  (port 8083)                         │
│    Knowledge Graph — LightRAG (file-based)              │
│    Trích xuất entity/quan hệ từ tài liệu                │
└─────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│         POSTGRESQL + PGVECTOR  (port 5435)              │
│                                                         │
│  Bảng: knowledge_bases, documents, vector_chunks,       │
│         document_images, document_tables, chat_messages │
└─────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              FPT CLOUD API (external)                   │
│   Embedding (1024d) | LLM Qwen3-32B | Reranker          │
└─────────────────────────────────────────────────────────┘
```

**Dữ liệu lưu trên máy host tại thư mục `.data/`:**
```
.data/
├── uploads/      — file PDF/DOCX gốc
├── docling/      — ảnh trang sau OCR (phân theo workspace)
├── lightrag/     — Knowledge Graph files (NetworkX + NanoVectorDB)
└── output/       — JSON tổng hợp (markdown + chunks + images)
```

---

## 3. Các service và nhiệm vụ

### 3.1 Frontend — `frontend/` (port 3001)

Giao diện web React. Người dùng tương tác ở đây.

**Chức năng:**
- Tạo/xóa workspace (không gian kiến thức độc lập)
- Upload tài liệu, theo dõi thanh tiến trình xử lý
- Chat và xem câu trả lời stream theo thời gian thực
- Xem citations (nguồn trích dẫn), ảnh, bảng biểu
- Xem/xóa lịch sử hội thoại

**Tech:** React 18, Vite, Tailwind CSS, Node 20

---

### 3.2 RAG Service — `rag-service/` (port 8081)

Service trung tâm, điều phối toàn bộ luồng chat và truy vấn.

**Chức năng:**
- Nhận câu hỏi từ frontend
- Embed câu hỏi → tìm kiếm vector + Knowledge Graph song song
- Rerank kết quả → build prompt → gọi LLM → stream về frontend
- Lưu lịch sử chat + citations vào DB
- Quản lý workspace (tạo/sửa/xóa)
- Cũng có thể trigger ingestion (process document)

**File quan trọng:**
- `rag-service/app/api/rag.py` — tất cả HTTP endpoints
- `rag-service/app/services/cuong_rag_service.py` — orchestrator chính
- `rag-service/app/services/deep_retriever.py` — hybrid retrieval + rerank
- `rag-service/app/services/vector_store.py` — PostgreSQL pgvector queries
- `rag-service/app/services/reranker.py` — cross-encoder reranking
- `rag-service/app/services/llm/` — LLM providers (Gemini / Ollama)

---

### 3.3 Ingestion Service — `ingestion-service/` (port 8082)

Chuyên xử lý tài liệu. Cần GPU (nvidia docker).

**Chức năng:**
- Nhận file upload, validate định dạng/kích thước
- OCR + layout analysis bằng Docling/MinerU/DeepSeek OCR
- Chuyển đổi sang Markdown, trích xuất ảnh và bảng
- Chunking + dedup
- Embed từng chunk → lưu vào `vector_chunks`
- Ingest Markdown vào Knowledge Graph (kg-service)

**File quan trọng:**
- `ingestion-service/app/api/ingestion.py` — endpoints `/ingest/*`
- `ingestion-service/app/api/documents.py` — endpoints `/documents/*`
- `ingestion-service/app/services/rag_service.py` — `process_document()`
- `ingestion-service/app/services/deep_document_parser.py` — OCR engine

**Định dạng hỗ trợ:** PDF, DOCX, TXT, MD, PPTX (tối đa 50MB)

---

### 3.4 KG Service — `kg-service/` (port 8083)

Quản lý Knowledge Graph dùng LightRAG.

**Chức năng:**
- Build/rebuild Knowledge Graph từ tài liệu đã index
- Trả về entities, relationships, graph data khi được query
- Không dùng bảng PostgreSQL — lưu file-based vào `.data/lightrag/{workspace_id}/`

**Công nghệ KG:** LightRAG với NetworkX (graph) + NanoVectorDB (vector)

**File quan trọng:**
- `kg-service/app/api/kg.py` — 5 endpoints KG
- `kg-service/app/services/knowledge_graph_service.py` — LightRAG adapter

---

### 3.5 PostgreSQL + pgvector (port 5435)

Database duy nhất của toàn hệ thống.

**Bảng chính:**

| Bảng | Lưu gì |
|------|--------|
| `knowledge_bases` | Thông tin workspace (tên, system prompt, cấu hình KG) |
| `documents` | Metadata file đã upload (tên, trạng thái, số trang...) |
| `document_images` | Ảnh trích xuất từ tài liệu |
| `document_tables` | Bảng trích xuất từ tài liệu |
| `vector_chunks` | Các đoạn văn bản + embedding vector 1024d |
| `chat_messages` | Lịch sử hội thoại (user + assistant) |

---

## 4. Cách chạy hệ thống

### Bước 1: Chuẩn bị môi trường

```bash
# Clone repo (nếu chưa có)
git clone <repo_url>
cd cuong_rag

# Copy file cấu hình
cp .env.example .env
```

Mở `.env` và điền các API key:
```env
# LLM provider (gemini hoặc ollama)
LLM_PROVIDER=gemini
GOOGLE_AI_API_KEY=your_gemini_api_key_here

# FPT Cloud API (embedding + reranker)
CUONGRAG_EMBEDDING_API_URL=https://...
CUONGRAG_RERANKER_API_URL=https://...
```

### Bước 2: Chạy lần đầu (setup)

```bash
make setup
# Lệnh này làm 3 việc:
# 1. Tạo .env nếu chưa có
# 2. Build tất cả Docker images
# 3. Khởi động tất cả services
```

Chờ khoảng 2–5 phút để build xong. Sau đó truy cập:
- **Giao diện web:** http://localhost:3001
- **RAG API docs:** http://localhost:8081/docs
- **Ingestion API docs:** http://localhost:8082/docs
- **KG API docs:** http://localhost:8083/docs

### Bước 3: Kiểm tra hệ thống

```bash
make health
# Kết quả mong đợi:
# --- RAG Service ---       {"status": "ok"}
# --- Ingestion Service --- {"status": "ok"}
# --- KG Service ---        {"status": "ok"}
```

### Các lệnh thường dùng

```bash
make up                       # Khởi động tất cả services
make down                     # Dừng tất cả services
make restart svc=rag-service  # Restart một service cụ thể
make logs                     # Xem logs tất cả services
make logs svc=rag-service     # Xem logs một service
make ps                       # Xem trạng thái containers
make clean                    # XÓA toàn bộ data (cẩn thận!)
```

### Chạy riêng lẻ từng service (dev mode)

```bash
cd rag-service
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8081
```

---

## 5. Luồng Upload tài liệu

Khi bạn upload file `baocao.pdf`:

```
[Bạn] → Chọn file → Click Upload
   │
   ▼
[Frontend] → POST /api/v1/ingest/upload/{workspace_id}
   │           gửi file lên ingestion-service
   │
   ▼
[Ingestion Service] ingestion-service/app/api/ingestion.py : line 92
   │  1. Validate: đúng định dạng? ≤ 50MB?
   │  2. Lưu file vào .data/uploads/baocao.pdf
   │  3. Tạo bản ghi Document trong DB → trạng thái PENDING
   │  4. Trả về ngay {"status": "PENDING"} cho frontend
   │  5. Spawn background task xử lý nền
   │
   ▼  (chạy nền, frontend polling /status/{doc_id})
[Background Task] ingestion-service/app/services/rag_service.py : process_document()
   │
   ├── PARSING: DeepDocumentParser.parse()
   │     → Docling OCR đọc PDF từng trang
   │     → Xuất ra Markdown + trích ảnh + trích bảng
   │     → Lưu markdown vào cột documents.markdown_content
   │     → Trạng thái: PARSING
   │
   ├── PROCESSING: Chunking + Dedup
   │     → Cắt Markdown thành chunks nhỏ (~512 tokens)
   │     → Loại bỏ chunks trùng lặp
   │     → Trạng thái: PROCESSING
   │
   ├── INDEXING: Embed + Lưu vector
   │     → Gọi FPT Cloud Embedding API: text → vector 1024d
   │     → INSERT vào bảng vector_chunks (pgvector)
   │     → Ingest Markdown vào KG Service (LightRAG)
   │     → Trạng thái: INDEXING
   │
   └── INDEXED: Hoàn tất
         → Cập nhật trạng thái INDEXED
         → Frontend hiển thị "✓ Sẵn sàng"
```

**State machine tài liệu:**
```
PENDING → PARSING → PROCESSING → INDEXING → INDEXED
                                              ↑
PENDING/PARSING/PROCESSING/INDEXING → FAILED (nếu có lỗi)
```

---

## 6. Luồng Chat — Ví dụ: "A là gì?"

Đây là luồng chi tiết nhất. Giả sử bạn đã upload tài liệu về chủ đề A và hỏi **"A là gì?"**

### Bước 1: Frontend gửi request

```
[Bạn gõ "A là gì?" và nhấn Enter]
   │
   ▼
[Frontend] POST http://localhost:8081/api/v1/rag/chat/{workspace_id}/stream
           Body: { "message": "A là gì?", "history": [...] }
```

---

### Bước 2: RAG Service nhận request

**File:** `rag-service/app/api/rag.py` — endpoint `POST /chat/{workspace_id}/stream`

```python
# rag-service/app/api/rag.py : line 850
@router.post("/chat/{workspace_id}/stream")
async def chat_stream(workspace_id, request, db):
    # Kiểm tra workspace tồn tại không
    kb = await verify_workspace_access(workspace_id, db)

    # Tạo RAG service instance
    rag_service = get_rag_service(db, workspace_id)

    # Chạy hybrid retrieval (vector + KG)
    result = await rag_service.query_deep(
        question="A là gì?",
        top_k=8,
        mode="hybrid"
    )
    # → result chứa: chunks, citations, kg_summary, image_refs
```

---

### Bước 3: Hybrid Retrieval (tìm kiếm song song)

**File:** `rag-service/app/services/deep_retriever.py` — `DeepRetriever.query()`

Hệ thống chạy 2 tác vụ **song song** cùng lúc:

```
"A là gì?"
    │
    ├──────── Task 1: Vector Search ────────────────────────┐
    │         deep_retriever.py : _vector_query()           │
    │                                                        │
    │  a. Embed câu hỏi:                                     │
    │     "A là gì?" → [0.12, -0.34, 0.87, ...] (1024 số)  │
    │     (gọi FPT Cloud Embedding API)                      │
    │                                                        │
    │  b. SQL query vào PostgreSQL:                          │
    │     SELECT chunk_id, document, metadata_json,          │
    │       (embedding <=> '[0.12,-0.34,...]') AS distance   │
    │     FROM vector_chunks                                 │
    │     WHERE workspace_id = {id}                          │
    │     ORDER BY distance ASC  ← gần nhất lên đầu         │
    │     LIMIT 30               ← lấy nhiều để rerank       │
    │                                                        │
    │  → Trả về: 30 chunks có nội dung gần với "A là gì?"   │
    │                                                        │
    └───────────────────────────────────────┐               │
                                            │               │
    ├──────── Task 2: Knowledge Graph ──────┘               │
    │         deep_retriever.py : _kg_query()               │
    │                                                        │
    │  Hỏi KG Service: "A là gì?"                           │
    │  LightRAG duyệt graph tìm entity "A"                  │
    │  và các quan hệ liên quan                              │
    │  → Trả về: tóm tắt ngữ cảnh đồ thị (kg_summary)      │
    │                                                        │
    └──────── Chờ cả 2 xong ────────────────────────────────┘
```

---

### Bước 4: Reranking (lọc chính xác hơn)

**File:** `rag-service/app/services/reranker.py` — `RerankerService.rerank()`

```
30 chunks thô từ vector search
    │
    ▼
Reranker (bge-reranker-v2-m3):
    Cross-encoder chấm điểm từng cặp ("A là gì?", chunk_i)
    → chunk nào liên quan nhất → điểm cao nhất
    │
    ▼
8 chunks tốt nhất (top_k=8)
```

Tại sao cần rerank? Vector search nhanh nhưng đôi khi lấy về chunk "gần về mặt từ ngữ" nhưng không thực sự trả lời câu hỏi. Reranker (cross-encoder) hiểu ngữ nghĩa sâu hơn và lọc chính xác hơn.

---

### Bước 5: Build Prompt gửi LLM

**File:** `rag-service/app/api/rag.py` — khoảng line 1045–1112

Hệ thống ghép prompt như sau:

```
SYSTEM PROMPT:
  "Bạn là trợ lý AI chuyên tra cứu tài liệu..."
  + workspace system prompt (nếu có)

USER MESSAGE:
  === NGUON TAI LIEU ===
  [a3x9] Trang 5: "A là khái niệm mô tả ... (nội dung chunk 1)"
  [b7k2] Trang 8: "Định nghĩa A bao gồm ... (nội dung chunk 2)"
  [c1m4] Trang 12: "Ứng dụng của A trong ... (nội dung chunk 3)"
  ... (8 chunks)
  === KET THUC NGUON ===

  [Ngữ cảnh KG nếu có]

  Quy tắc trả lời:
  - Chỉ dùng thông tin từ nguồn trên
  - Ghi rõ nguồn [a3x9] khi trích dẫn
  - Không bịa đặt thông tin ngoài tài liệu

  Câu hỏi: "A là gì?"
```

---

### Bước 6: Gọi LLM và Stream về Frontend

**File:** `rag-service/app/services/llm/gemini.py`

```
Prompt → Gemini API (Qwen3-32B)
    │
    ▼ Stream từng token
"A" → "A" → " là" → " một" → " khái" → " niệm" → ...
    │
    ▼ SSE (Server-Sent Events)
Frontend nhận từng token → hiển thị dần như typing
```

---

### Bước 7: Lưu kết quả vào DB

**File:** `rag-service/app/api/rag.py`

```python
# Lưu tin nhắn người dùng
ChatMessage(role="user", content="A là gì?", workspace_id=...)

# Lưu câu trả lời + nguồn trích dẫn
ChatMessage(
    role="assistant",
    content="A là một khái niệm... [a3x9][b7k2]",
    sources=[{"id": "a3x9", "page": 5, ...}, ...],
    workspace_id=...
)
```

---

### Kết quả cuối cùng

```
[Frontend hiển thị]

Bạn: "A là gì?"

Bot: "A là một khái niệm quan trọng trong lĩnh vực...
      Theo định nghĩa [a3x9], A bao gồm các thành phần...
      Ứng dụng thực tế [b7k2] cho thấy..."

📎 Nguồn: [a3x9] baocao.pdf trang 5
          [b7k2] baocao.pdf trang 8
🖼️ Hình: [ảnh từ trang 5 nếu có]
```

---

### Tóm tắt luồng chat (sơ đồ gọn)

```
User: "A là gì?"
    ↓
Frontend → POST /rag/chat/{ws_id}/stream          [rag.py:850]
    ↓
verify workspace                                   [rag.py]
    ↓
query_deep("A là gì?")                            [cuong_rag_service.py]
    ↓
DeepRetriever.query()                             [deep_retriever.py:63]
    ├── PARALLEL:
    │   ├── embed query → SQL pgvector search     [vector_store.py:128]
    │   └── LightRAG graph query                  [knowledge_graph_service.py]
    └── rerank(30 chunks → 8 chunks)              [reranker.py:145]
    ↓
build prompt (context + rules + question)         [rag.py:1045]
    ↓
LLM stream (Gemini / Ollama)                      [llm/gemini.py]
    ↓
SSE stream → Frontend → hiển thị dần
    ↓
save ChatMessage to DB                            [rag.py]
```

---

## 7. Cơ sở dữ liệu

### Bảng `knowledge_bases` (workspace)

```sql
id          INT PRIMARY KEY
name        VARCHAR(255)        -- "Workspace Demo"
description TEXT
system_prompt TEXT              -- Hướng dẫn cho LLM
kg_language VARCHAR(50)         -- "vi" hoặc "en"
kg_entity_types JSON            -- ["PERSON", "ORG", ...]
created_at, updated_at DATETIME
```

### Bảng `documents`

```sql
id              INT PRIMARY KEY
workspace_id    INT → knowledge_bases.id
filename        VARCHAR(255)
status          ENUM(pending,parsing,processing,indexing,indexed,failed)
markdown_content TEXT            -- Nội dung sau OCR
chunk_count     INT
page_count      INT
processing_time_ms INT
error_message   VARCHAR(500)
```

### Bảng `vector_chunks` (tạo động bởi pgvector)

```sql
workspace_id    INT
chunk_id        TEXT  -- "doc_5_chunk_12"
document        TEXT  -- nội dung chunk
embedding       VECTOR(1024)  -- vector 1024 chiều
metadata_json   JSONB  -- {source, page_no, heading_path, image_ids, ...}
document_id     INT
PRIMARY KEY (workspace_id, chunk_id)
```

### Bảng `chat_messages`

```sql
id          INT PRIMARY KEY
workspace_id INT
role        VARCHAR(20)  -- "user" | "assistant"
content     TEXT
sources     JSONB         -- danh sách citations
thinking    TEXT          -- chain-of-thought nếu bật
created_at  DATETIME
```

---

## 8. Cấu hình & biến môi trường

File `.env` (copy từ `.env.example`):

```env
# === LLM Provider ===
LLM_PROVIDER=gemini              # hoặc "ollama"
GOOGLE_AI_API_KEY=AIza...        # API key Gemini
GEMINI_MODEL=gemini-2.0-flash    # model sử dụng

# === FPT Cloud (Embedding + Reranker) ===
CUONGRAG_EMBEDDING_API_URL=https://api.fpt.ai/...
CUONGRAG_EMBEDDING_API_KEY=...
CUONGRAG_RERANKER_API_URL=https://api.fpt.ai/...

# === PostgreSQL ===
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=cuong_rag

# === Retrieval Settings ===
CUONGRAG_VECTOR_PREFETCH=30     # lấy bao nhiêu chunks trước rerank
CUONGRAG_RERANKER_TOP_K=8       # giữ lại bao nhiêu chunks sau rerank

# === OCR Engine ===
CUONGRAG_OCR_ENGINE=docling     # docling | mineru | deepseek_ocr

# === KG ===
CUONGRAG_KG_ENABLED=true        # bật/tắt Knowledge Graph
```

---

## 9. Lệnh hữu ích

### Quản lý hệ thống

```bash
make setup          # Chạy lần đầu (build + start)
make up             # Start tất cả
make down           # Stop tất cả
make restart svc=rag-service  # Restart 1 service
make ps             # Xem trạng thái containers
make health         # Kiểm tra sức khỏe services
make clean          # ⚠️  XÓA TOÀN BỘ DATA
```

### Debug logs

```bash
make logs                       # Log tất cả (Ctrl+C để thoát)
make logs svc=rag-service       # Log RAG service
make logs svc=ingestion-service # Log ingestion
make logs svc=kg-service        # Log KG
make logs svc=postgres          # Log database
```

### Truy cập thẳng vào database

```bash
docker exec -it cuongrag-postgres psql -U postgres -d cuong_rag

-- Xem tất cả documents
SELECT id, filename, status, chunk_count FROM documents;

-- Xem tất cả workspaces
SELECT id, name FROM knowledge_bases;

-- Đếm vectors theo workspace
SELECT workspace_id, count(*) FROM vector_chunks GROUP BY workspace_id;
```

### Test API trực tiếp (curl)

```bash
# Health check
curl http://localhost:8081/health

# Xem danh sách workspace
curl http://localhost:8081/api/v1/workspaces

# Chat (thay {ws_id} bằng ID workspace thực)
curl -X POST http://localhost:8081/api/v1/rag/chat/{ws_id} \
  -H "Content-Type: application/json" \
  -d '{"message": "A là gì?", "history": []}'

# Xem status document (thay {doc_id} bằng ID doc thực)
curl http://localhost:8082/api/v1/ingest/status/{doc_id}
```

---

*Tài liệu được tổng hợp từ code thực tế trong repo CuongRAG. Cập nhật lần cuối: 2026-05-13.*
