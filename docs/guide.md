# Guide chạy dự án

Hướng dẫn thao tác nhanh cho dev/test.

## 1) Chạy full stack bằng Docker (khuyến nghị)

```bash
cd cuong_rag
cp .env.example .env   # nếu chưa có

# Nếu dùng Ollama local, pull model trước
ollama pull qwen3:8b

docker compose up -d
```

Mở ứng dụng: <http://localhost:3001>

## 2) Kiểm tra trạng thái

```bash
docker compose ps
docker compose logs -f rag-service
```

## 3) Quy trình sử dụng trên UI

1. Vào **Workspaces** → tạo workspace.
2. Vào **Documents** → upload tài liệu (`pdf/txt/md/docx/pptx`).
3. Bấm **Process/Analyze** để parse + index.
4. Vào **Chat** để hỏi đáp với dữ liệu đã index.
5. Vào **Knowledge Graph** để xem entities/relationships.
6. Vào **Analytics** để xem số liệu tổng hợp.

## 4) Chạy frontend local (hot reload)

Giữ backend bằng Docker, frontend chạy máy local:

```bash
# Terminal 1: ở root project
cd cuong_rag
docker compose up -d postgres rag-service ingestion-service kg-service

# Terminal 2: frontend local
cd cuong_rag/frontend
yarn install
yarn dev --host 0.0.0.0
```

Truy cập: <http://localhost:3000>

## 5) Chạy từng backend service local (không Docker cho service)

```bash
# postgres bằng docker
cd cuong_rag
docker compose up -d postgres

# rag-service
cd rag-service
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8081

# ingestion-service
cd ../ingestion-service
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8082

# kg-service
cd ../kg-service
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8083
```

## 6) Các lệnh Docker hay dùng

```bash
# đúng cú pháp build+up cho một service
docker compose up -d --build frontend

# chỉ chạy lại frontend
docker compose up -d frontend

# restart frontend
docker compose restart frontend
```

## 7) API docs (Swagger)

- RAG: <http://localhost:8081/docs>
- Ingestion: <http://localhost:8082/docs>
- KG: <http://localhost:8083/docs>

## 8) Lỗi thường gặp

### 8.1 Không thấy thay đổi favicon/avatar
- Hard refresh: `Ctrl+Shift+R`
- Xóa cache trình duyệt hoặc mở tab ẩn danh.

### 8.2 Lỗi chat/ingest
```bash
docker compose logs -f rag-service
docker compose logs -f ingestion-service
```

### 8.3 Reset toàn bộ dữ liệu
```bash
docker compose down -v
```

## 9) File quan trọng cần biết

- `docker-compose.yml`: cấu hình runtime toàn hệ thống
- `.env.example`: mẫu biến môi trường
- `Makefile`: shortcut lệnh vận hành
- `frontend/src/api/client.js`: API client của UI
- `rag-service/app/api/rag.py`: endpoints chat/query/analytics chính
