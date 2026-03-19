# CuongRAG — RAG Microservices Platform

Hệ thống RAG (Retrieval-Augmented Generation) theo kiến trúc microservices, tách biệt rõ ràng các services. Bản local dev không dùng Nginx gateway.

## Kiến trúc

```
 ┌────────────┐   ┌────────────────┐   ┌───────────┐
 │ rag-svc    │   │ ingestion-svc  │   │ kg-svc    │
 │ :8081      │   │ :8082          │   │ :8083     │
 └─────┬──────┘   └───────┬────────┘   └─────┬─────┘
       │                  │                  │
       └──────────────────┴──────────────────┘
                          │
            ┌─────────────┴───────────┐
            │       PostgreSQL        │
            │         :5435           │
            └─────────────────────────┘
```

| Service | Port | Vai trò |
|---------|------|---------|
| `rag-service` | 8081 | Workspaces, Chat, Query |
| `ingestion-service` | 8082 | Upload, OCR Parse (MinerU/Docling), Index |
| `kg-service` | 8083 | Knowledge Graph |
| `frontend` | 3001 | React UI |
| `postgres` | 5435 | Metadata DB + Vector Store (pgvector) |

## Quickstart

```bash
# 1. Clone & setup env
cd cuong_rag
cp .env.example .env
# → Mặc định FREE mode (Ollama local), không cần API key

# 1.1 Cài model Ollama (khuyến nghị cho 12GB VRAM)
ollama pull qwen2.5:7b

# 2. Chạy tất cả services
docker compose up -d

# 3. Kiểm tra health
curl http://localhost:8081/health
curl http://localhost:8082/health
curl http://localhost:8083/health

# 4. Mở UI
open http://localhost:3001
```

> Nếu không dùng Ollama local, bạn có thể chuyển sang Gemini trong `.env`.

## API Endpoints

### RAG Service (Base URL: `http://localhost:8081`)
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/v1/workspaces` | List knowledge bases |
| POST | `/api/v1/workspaces` | Tạo workspace |
| POST | `/api/v1/rag/chat/{workspace_id}` | Chat với RAG |
| POST | `/api/v1/rag/query/{workspace_id}` | Query thuần |
| GET | `/api/v1/rag/chat/{workspace_id}/history` | Lịch sử chat |

### Ingestion Service (Base URL: `http://localhost:8082`)
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/v1/documents/upload/{workspace_id}` | Upload file |
| POST | `/api/v1/rag/process/{document_id}` | Trigger parse + index |
| POST | `/api/v1/rag/process-batch` | Batch process |
| GET | `/api/v1/documents/{workspace_id}` | List documents |
| DELETE | `/api/v1/documents/{document_id}` | Xóa document |

### KG Service (Base URL: `http://localhost:8083`)
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/v1/rag/entities/{workspace_id}` | Entities |
| GET | `/api/v1/rag/relationships/{workspace_id}` | Relationships |
| GET | `/api/v1/rag/graph/{workspace_id}` | Graph data |
| GET | `/api/v1/rag/analytics/{workspace_id}` | Analytics |

## Development (chạy từng service)

```bash
# 1. Start infrastructure
docker compose up postgres -d

# 2. RAG Service
cd rag-service
pip install -r requirements.txt
uvicorn app.main:app --port 8081 --reload

# 3. Ingestion Service
cd ingestion-service
uvicorn app.main:app --port 8082 --reload

# 4. KG Service
cd kg-service
uvicorn app.main:app --port 8083 --reload

# 5. Frontend
cd frontend
npm install && npm run dev
```

## Cấu hình LLM

Trong `.env`, chọn một trong hai provider:

**Gemini (default):**
```
LLM_PROVIDER=gemini
GOOGLE_AI_API_KEY=your-key
LLM_MODEL_FAST=gemini-2.5-flash
```

**Ollama (local):**
```
LLM_PROVIDER=ollama
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=gemma3:12b
```
