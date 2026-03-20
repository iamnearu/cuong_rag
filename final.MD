# Hướng dẫn chạy CuongRAG ổn định (LLM trả lời được)

Tài liệu này là checklist chạy thực tế để:
- toàn bộ service lên ổn định,
- OCR/index chạy được,
- LLM trả lời được qua `rag-service`.

---

## 0) Mục tiêu sau khi hoàn tất

Bạn phải đạt đủ các điều kiện:
- `postgres`, `rag-service`, `ingestion-service`, `kg-service`, `frontend` đều `Up`.
- `ollama` có model `qwen3:8b`.
- `rag-service` gọi được Ollama qua `host.docker.internal:11435`.
- Upload + index thành công (`indexed`).
- Chat API trả về `answer` khác rỗng.

---

## 1) Chuẩn bị môi trường

### 1.1 Vào project

```bash
cd /home/cuongnh/cuong/cuong_rag
```

### 1.2 Kiểm tra Docker / Compose

```bash
docker --version
docker compose version
```

### 1.3 Kiểm tra GPU cho Docker

```bash
docker run --rm --gpus all nvidia/cuda:12.3.2-base-ubuntu22.04 nvidia-smi
```

Nếu lệnh này lỗi, phải sửa NVIDIA Container Toolkit trước.

---

## 2) Kiểm tra cấu hình `.env`

Mở file `.env` và đảm bảo tối thiểu có các dòng sau:

```dotenv
# LLM
LLM_PROVIDER=ollama
OLLAMA_HOST=http://host.docker.internal:11435
OLLAMA_MODEL=qwen3:8b

# OCR + ProtonX
CUONGRAG_OCR_ENGINE=mineru
CUONGRAG_ENABLE_PROTONX_CORRECTION=true

# KG ổn định hơn trên máy 12GB
KG_EMBEDDING_DEVICE=cpu
CUONGRAG_KG_EMBEDDING_MAX_ASYNC=1
CUONGRAG_KG_EMBEDDING_TIMEOUT_SECONDS=180
CUONGRAG_KG_LLM_TIMEOUT_SECONDS=240
```

---

## 3) Bật Ollama và model

### 3.1 Bật Ollama host

```bash
ollama serve
```

(hoặc dùng systemd nếu máy bạn cấu hình sẵn)

```bash
systemctl status ollama --no-pager -n 20
```

### 3.2 Kéo model

```bash
ollama pull qwen3:8b
```

### 3.3 Kiểm tra host Ollama

```bash
curl http://localhost:11434/api/tags
```

---

## 4) Mở proxy cho container gọi Ollama

```bash
docker rm -f ollama-proxy >/dev/null 2>&1 || true
docker run -d --name ollama-proxy --network host alpine/socat \
  TCP-LISTEN:11435,fork,reuseaddr,bind=0.0.0.0 TCP:127.0.0.1:11434
```

Kiểm tra proxy:

```bash
curl http://localhost:11435/api/tags
```

---

## 5) Dựng toàn bộ services

```bash
docker compose up -d
```

Kiểm tra container:

```bash
docker compose ps
```

Kỳ vọng: các service `postgres`, `rag-service`, `ingestion-service`, `kg-service`, `frontend` đều `Up`.

---

## 6) Kiểm tra health endpoints

```bash
curl -i http://localhost:8081/health
curl -i http://localhost:8082/health
curl -i http://localhost:8083/health
```

Kỳ vọng: HTTP `200 OK`.

---

## 7) Kiểm tra đường đi LLM (bắt buộc)

### 7.1 Từ trong `rag-service` gọi Ollama

```bash
docker compose exec -T rag-service sh -lc "curl -fsS http://host.docker.internal:11435/api/tags"
```

Nếu fail, chat sẽ lỗi `Unable to generate a response`.

### 7.2 Kiểm tra model trong Ollama

```bash
ollama ps
```

Có `qwen3:8b` là tốt.

---

## 8) Kiểm tra OCR path (MinerU + ProtonX)

### 8.1 Xác nhận `mineru` có trong ingestion container

```bash
docker compose exec -T ingestion-service sh -lc "which mineru"
```

### 8.2 Xác nhận env OCR đã nạp

```bash
docker compose exec -T ingestion-service sh -lc 'echo CUONGRAG_OCR_ENGINE=$CUONGRAG_OCR_ENGINE; echo CUONGRAG_ENABLE_PROTONX_CORRECTION=$CUONGRAG_ENABLE_PROTONX_CORRECTION'
```

Kỳ vọng:
- `CUONGRAG_OCR_ENGINE=mineru`
- `CUONGRAG_ENABLE_PROTONX_CORRECTION=true`

---

## 9) Test end-to-end nhanh nhất

### 9.1 Upload + index one-shot

```bash
curl -X POST http://localhost:8082/api/v1/ingest/easy-index \
  -F "file=@/duong_dan/test.pdf" \
  -F "workspace_name=test-mineru" \
  -F "auto_create_workspace=true" \
  -F "wait_for_index=true" \
  -F "timeout_seconds=240"
```

Lưu lại `workspace_id` từ response.

### 9.2 Test chat API

```bash
curl -X POST http://localhost:8081/api/v1/rag/chat/<WORKSPACE_ID> \
  -H "Content-Type: application/json" \
  -d '{"message":"Tóm tắt tài liệu vừa upload","history":[],"enable_thinking":false}'
```

Kỳ vọng: response có `answer` khác rỗng.

---

## 10) Nếu lỗi, debug nhanh

### 10.1 Log theo service

```bash
docker compose logs -f rag-service
docker compose logs -f ingestion-service
docker compose logs -f kg-service
```

### 10.2 Chat không trả lời

```bash
curl http://localhost:11435/api/tags
docker compose exec -T rag-service sh -lc "curl http://host.docker.internal:11435/api/tags"
docker compose restart rag-service
```

### 10.3 Upload/index không lên `indexed`

```bash
docker compose logs -f ingestion-service
```

### 10.4 KG timeout (`Worker execution timeout after 60s`)

Giữ đúng config trong `.env`:

```dotenv
KG_EMBEDDING_DEVICE=cpu
CUONGRAG_KG_EMBEDDING_MAX_ASYNC=1
CUONGRAG_KG_EMBEDDING_TIMEOUT_SECONDS=180
CUONGRAG_KG_LLM_TIMEOUT_SECONDS=240
```

Sau đó restart ingestion:

```bash
docker compose up -d ingestion-service
```

---

## 11) Lệnh vận hành hằng ngày

```bash
cd /home/cuongnh/cuong/cuong_rag
make up
make ps
make health
make logs svc=rag-service
make logs svc=ingestion-service
make logs svc=kg-service
make down
```

---

## 12) Checklist PASS cuối cùng

Đánh dấu PASS khi:
- [ ] `docker compose ps` tất cả service đều `Up`
- [ ] `curl :8081/health`, `:8082/health`, `:8083/health` đều 200
- [ ] `rag-service` gọi được `host.docker.internal:11435/api/tags`
- [ ] `which mineru` trong ingestion có kết quả
- [ ] `easy-index` trả `indexed`
- [ ] `rag/chat/<workspace_id>` trả `answer` có nội dung
