# Infrastructure Setup

Tài liệu setup hạ tầng cho CuongRAG trong môi trường local bằng Docker Compose.

## 1) Kiến trúc hạ tầng

```text
Frontend (3001) ────────┐
                         │ HTTP /api/v1
                         ▼
                   rag-service (8081)
                         │
                         ├── gọi xử lý ingest (qua API/DB)
                         ├── gọi KG service (qua DB + service logic)
                         ▼
                   PostgreSQL + pgvector (5435 host / 5432 container)

ingestion-service (8082)  ── parse + chunk + index
kg-service (8083)         ── entities / relationships / graph / analytics
```

## 2) Thành phần trong docker-compose

| Service | Container | Port host | Vai trò |
|---|---|---:|---|
| postgres | cuongrag-postgres | 5435 | CSDL metadata + vector |
| rag-service | cuongrag-rag-service | 8081 | Workspace, documents, chat, query |
| ingestion-service | cuongrag-ingestion-service | 8082 | Upload, process, batch ingest |
| kg-service | cuongrag-kg-service | 8083 | Truy vấn đồ thị tri thức |
| frontend | cuongrag-frontend | 3001 | UI React |

## 3) Persistent volumes

- `cuongrag_postgres_data`: dữ liệu Postgres/pgvector
- `cuongrag_uploads`: file upload dùng chung
- `cuongrag_data`: dữ liệu bổ trợ/chuyển đổi

## 4) Yêu cầu máy

### Tối thiểu
- Docker + Docker Compose plugin
- RAM 16GB
- CPU 4 cores
- Disk trống >= 20GB

### Khuyến nghị khi chạy local LLM/OCR
- GPU NVIDIA (nếu bật cấu hình CUDA)
- VRAM 12GB (theo runbook hiện có)
- Đã cài Ollama nếu dùng `LLM_PROVIDER=ollama`

## 5) Chuẩn bị biến môi trường

```bash
cp .env.example .env
```

Các biến quan trọng:

- DB: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- LLM: `LLM_PROVIDER`, `OLLAMA_HOST`, `OLLAMA_MODEL`, `GOOGLE_AI_API_KEY`
- Pipeline CuongRAG: `CUONGRAG_*`
- KG embedding: `KG_EMBEDDING_*`

## 6) Khởi động hạ tầng

Từ thư mục gốc `cuong_rag`:

```bash
docker compose up -d
```

Kiểm tra:

```bash
docker compose ps
curl http://localhost:8081/health
curl http://localhost:8082/health
curl http://localhost:8083/health
```

## 7) Vận hành thường dùng

```bash
# Xem log tất cả
docker compose logs -f

# Xem log 1 service
docker compose logs -f rag-service

# Restart service
docker compose restart frontend

# Stop toàn bộ
docker compose down

# Xóa cả volume dữ liệu
docker compose down -v
```

Có thể dùng Makefile:

```bash
make up
make ps
make logs svc=rag-service
make down
make clean
```

## 8) Networking & CORS

- Frontend truy cập API qua `/api` proxy hoặc `VITE_API_BASE_URL`
- Trong compose: frontend chạy với `VITE_API_BASE_URL=http://rag-service:8081`
- CORS đã mở cho:
  - `http://localhost:3001`
  - `http://localhost`

## 9) Build/rebuild

- Trường hợp thường: `docker compose up -d`
- Khi đổi Dockerfile/dependencies backend: `docker compose up -d --build`
- Frontend trong compose hiện chạy `yarn dev` + mount source, thường không cần build image riêng.

## 10) Favicon / Avatar assets

Các tài nguyên branding hiện tại:

- `frontend/public/bot-avatar.svg`
- `frontend/index.html` dùng icon tab trình duyệt từ `/bot-avatar.svg`
- `frontend/public/manifest.json` dùng icon PWA từ `/bot-avatar.svg`
