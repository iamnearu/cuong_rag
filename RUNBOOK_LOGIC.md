# CuongRAG Runbook Logic — Cách chạy dự án theo bản chất hệ thống

Tài liệu này giúp bạn **vừa chạy được**, vừa hiểu **vì sao phải chạy theo thứ tự đó**.

> Nếu bạn muốn bản **cầm tay chỉ việc cho máy 12GB VRAM**, xem thêm: `RUNBOOK_12GB_CAMTAY.md`.

---

## 1) Bản chất hệ thống (mental model)

CuongRAG là hệ RAG microservices, gồm 3 backend service chính + frontend:

- `rag-service` (cổng 8081): chat/query, điều phối trả lời
- `ingestion-service` (cổng 8082): upload file, parse/chunk/index
- `kg-service` (cổng 8083): knowledge graph (entity/relationship)
- `frontend` (cổng 3001): giao diện người dùng

Dùng chung hạ tầng:

- PostgreSQL + pgvector (5435): metadata + vector embedding/chunk

### Luồng bản chất

1. Upload tài liệu vào `ingestion-service`
2. `ingestion-service` parse/chunk + tạo embedding + index vào pgvector
3. `rag-service` nhận query, retrieve context từ vector/KG, gọi LLM để trả lời
4. `kg-service` phục vụ graph/analytics cho dữ liệu đã xử lý

=> Nếu ingestion chưa index xong, chat sẽ thiếu ngữ cảnh hoặc trả lời kém.

---

## 2) Dependency chain (cái gì cần cái gì)

### Cấp 1: Runtime nền tảng

- Docker + Docker Compose
- Ollama chạy trên host (để dùng model free/local)

### Cấp 2: Mô hình AI local

- 1 model chat trong Ollama (đề xuất: `qwen2.5:7b` cho 12GB VRAM)
- Sentence-transformers model (tự tải khi service chạy, ví dụ `BAAI/bge-m3`)
- Cross-encoder reranker (tự tải khi cần, ví dụ `BAAI/bge-reranker-v2-m3`)

### Cấp 3: Hạ tầng dữ liệu

- PostgreSQL + pgvector phải chạy trước (service cần đọc/ghi metadata + vector)

### Cấp 4: Backend services

- `rag-service`, `ingestion-service`, `kg-service` phụ thuộc PostgreSQL (pgvector) + Ollama
- Các service này dùng biến môi trường từ `.env`

### Cấp 5: Frontend

- Frontend cần backend đã healthy mới usable

---

## 3) Chuẩn bị trước khi chạy (preflight)

## 3.1 Kiểm tra Docker

```bash
docker --version
docker compose version
```

## 3.2 Kiểm tra Ollama host

```bash
ollama --version
ollama serve
```

Mở terminal mới và kéo model:

```bash
ollama pull qwen2.5:7b
```

> Nếu thiếu RAM/VRAM, dùng model nhẹ hơn (ví dụ `qwen2.5:3b`).

## 3.3 Chuẩn bị env dự án

Trong thư mục `cuong_rag`:

```bash
cp .env.example .env
```

File `.env` đang được cấu hình local/free-first:

- `LLM_PROVIDER=ollama`
- `OLLAMA_HOST=http://host.docker.internal:11434`
- `OLLAMA_MODEL=qwen2.5:7b`
- `KG_EMBEDDING_PROVIDER=sentence_transformers`
- `CUONGRAG_OCR_ENGINE=docling`
- `CUONGRAG_ENABLE_PROTONX_CORRECTION=false`

---

## 4) Thứ tự chạy logic (đúng dependency)

## Bước 1 — Dựng toàn bộ stack

```bash
docker compose up -d
```

Vì sao chạy lệnh này trước?

- Nó dựng PostgreSQL + 3 backend + frontend theo dependency đã định nghĩa.
    
## Bước 2 — Chờ healthy

```bash
docker compose ps
```

Mục tiêu:

- `rag-service`, `ingestion-service`, `kg-service` là `healthy`

## Bước 3 — Health check API

```bash
curl http://localhost:8081/health
curl http://localhost:8082/health
curl http://localhost:8083/health
```

Nếu 3 endpoint OK thì lớp backend đã sẵn sàng.

## Bước 4 — Mở UI

Mở: `http://localhost:3001`

---

## 5) Luồng test đúng bản chất RAG (end-to-end)

## Bước A — Tạo workspace

- Tạo knowledge base mới trên UI

## Bước B — Upload document

- Upload file PDF/DOCX/TXT
- Hệ thống chuyển trạng thái: `UPLOADED` -> `PARSING` -> `INDEXING` -> `INDEXED`

## Bước C — Chờ index xong rồi mới chat

Vì sao?

- RAG cần vector/chunk đã được index vào pgvector. Nếu hỏi quá sớm, retrieval sẽ rỗng.

## Bước D — Chat/query

- Đặt câu hỏi có trong tài liệu
- Kiểm tra có citations/sources

## Bước E — Mở analytics/KG

- Kiểm tra entities/relationships/chunks có tăng

---

## 6) Giải thích “vì sao dự án chạy được”

Hệ thống trả lời tốt khi 4 điều kiện đồng thời đúng:

1. Dữ liệu vào đã parse được (`ingestion-service`)
2. Dữ liệu đã index vào pgvector
3. Retrieval lấy đúng context (`rag-service` + reranker)
4. LLM local chạy ổn (Ollama model đang sẵn)

Thiếu 1 trong 4 điều kiện, chất lượng trả lời sẽ giảm mạnh.

---

## 7) Checklist lỗi thường gặp và gỡ theo logic

## 7.1 Chat lỗi timeout hoặc rỗng

Nguyên nhân thường gặp:

- Ollama chưa chạy
- Model chưa pull
- Model quá nặng so với tài nguyên

Cách xử lý:

1. `ollama ps` kiểm tra model
2. pull model nhẹ hơn (`qwen2.5:3b`)
3. restart service: `docker compose restart rag-service`

## 7.2 Upload xong nhưng không index

Nguyên nhân thường gặp:

- `ingestion-service` lỗi parse
- lỗi pgvector/indexing (extension hoặc dữ liệu embedding)

Cách xử lý:

1. xem log `ingestion-service`
2. xem log `rag-service` (retrieval/vector)
3. kiểm tra container postgres đã chạy ổn
4. thử file nhỏ hơn trước (TXT/MD)

## 7.3 Frontend mở được nhưng thao tác lỗi API

Nguyên nhân thường gặp:

- Một backend chưa healthy
- CORS/env sai

Cách xử lý:

1. kiểm tra 3 endpoint health
2. kiểm tra `.env` và `docker compose ps`

## 7.4 Container không gọi được Ollama host (Linux)

Nguyên nhân thường gặp:

- thiếu host mapping

Trạng thái hiện tại:

- Compose đã có `extra_hosts: host.docker.internal:host-gateway`

---

## 8) Cách chạy tối ưu cho máy 12GB VRAM (gợi ý thực tế)

- Chat model: `qwen2.5:7b`
- Tắt thinking: `OLLAMA_ENABLE_THINKING=false`
- Tắt image/table captioning khi test sớm
- OCR để `docling` trước (ổn định), chưa cần MinerU/ProtonX

Khi hệ thống chạy ổn end-to-end, mới tăng dần:

1. bật captioning
2. thử model lớn hơn
3. bật MinerU + ProtonX

---

## 9) Quy trình làm việc khuyến nghị (để vừa học vừa chạy)

1. Chạy hệ thống với cấu hình free/local hiện tại
2. Test 1 tài liệu nhỏ -> xác nhận pipeline end-to-end
3. Test 1 PDF lớn -> quan sát thời gian parse/index
4. So sánh câu trả lời có/không có KG mode
5. Sau khi ổn định mới tinh chỉnh model và threshold

---

## 10) Lệnh thao tác nhanh

```bash
# Tại thư mục cuong_rag
make up
make ps
make health
make logs svc=rag-service
make logs svc=ingestion-service
make logs svc=kg-service
make down
```

---

## 11) Kết luận ngắn

Để chạy thành công, thứ tự logic luôn là:

**Model local sẵn sàng -> PostgreSQL sẵn sàng -> Ingestion index xong -> mới Chat/RAG**.

Nếu bám đúng chuỗi phụ thuộc này, bạn sẽ vừa hiểu bản chất, vừa vận hành ổn định dự án.