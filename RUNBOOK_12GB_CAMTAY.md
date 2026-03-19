# CuongRAG 12GB VRAM — Cầm tay chỉ việc (ALL-GPU TEST MODE)

Mục tiêu: chạy toàn bộ pipeline trên 1 máy 12GB VRAM, ưu tiên **chạy được nhanh để test**.

---

## 0) Bạn sẽ chạy cái gì?

Bạn sẽ chạy các service sau trên cùng 1 máy:

- `postgres` (metadata + pgvector)
- `rag-service` (chat/query)
- `ingestion-service` (upload + parse + index)
- `kg-service` (knowledge graph)
- `frontend` (UI)
- `ollama` (LLM local trên host)

---

## 1) Tính toán VRAM (all-GPU)

## 1.1 Phân bổ VRAM đề xuất

| Thành phần | Dùng GPU? | VRAM ước tính |
|---|---:|---:|
| Ollama `qwen3:8b` (Q4) | Có | ~4.5–7.0 GB |
| Embedding `all-MiniLM-L6-v2` | Có | ~0.8–1.5 GB |
| Reranker `ms-marco-MiniLM-L-6-v2` | Có | ~0.8–1.5 GB |
| OCR MinerU/ProtonX | Tắt mặc định | ~0 GB |
| Buffer CUDA/system | Có | ~1.0–2.0 GB |
| **Tổng** |  | **~4.8–8.5 GB** |

=> Với 12GB VRAM: chạy được, còn dư để tránh OOM trong test.

## 1.2 Chế độ đã khóa sẵn

- `CUONGRAG_EMBEDDING_DEVICE=cuda`
- `CUONGRAG_RERANKER_DEVICE=cuda`
- `OLLAMA_MODEL=qwen3:8b`

---

## 2) Điều kiện bắt buộc trước khi chạy

## 2.1 Docker + Compose

```bash
docker --version
docker compose version
```

## 2.2 GPU cho Docker container (NVIDIA Container Toolkit)

Kiểm tra nhanh:

```bash
docker run --rm --gpus all nvidia/cuda:12.3.2-base-ubuntu22.04 nvidia-smi
```

Nếu lệnh này lỗi thì backend trong Docker không dùng GPU được.

## 2.3 Ollama trên host

```bash
ollama --version
```

Quan trọng: service Ollama mặc định thường chỉ bind `127.0.0.1:11434` nên container Docker không gọi trực tiếp được.

Vì vậy runbook này dùng **proxy port 11435** để `rag-service` truy cập Ollama ổn định.

Kiểm tra nhanh:

```bash
curl http://localhost:11434/api/tags
```

---

## 3) Chạy lần đầu (copy/paste theo thứ tự)

## Bước 1 — Vào project

```bash
cd /home/cuongnh/cuong/cuong_rag
```

## Bước 2 — Bật Ollama

Terminal 1:

```bash
ollama serve
```

Nếu bạn đang dùng systemd (thường là có), chỉ cần đảm bảo service chạy:

```bash
systemctl status ollama --no-pager -n 20
```

## Bước 3 — Kéo model LLM

Terminal 2:

```bash
ollama pull qwen3:8b
```

## Bước 3.1 — Mở proxy để container gọi Ollama

Trong project `cuong_rag`, chạy:

```bash
docker rm -f ollama-proxy >/dev/null 2>&1 || true
docker run -d --name ollama-proxy --network host alpine/socat \
	TCP-LISTEN:11435,fork,reuseaddr,bind=0.0.0.0 TCP:127.0.0.1:11434
```

Kiểm tra proxy:

```bash
curl http://localhost:11435/api/tags
```

Kỳ vọng thấy model `qwen3:8b`.

## Bước 3.2 — Cấu hình `.env` cho chat

Mở file `.env` và đảm bảo:

```dotenv
LLM_PROVIDER=ollama
OLLAMA_HOST=http://host.docker.internal:11435
OLLAMA_MODEL=qwen3:8b
```

## Bước 4 — Dựng stack

Terminal 3:

```bash
docker compose up -d
```

Nếu trước đó chạy bản cũ bị lỗi:

```bash
docker compose down -v
docker compose up -d
```

Sau khi sửa `.env`, nhớ recreate `rag-service` để nhận biến mới:

```bash
docker compose up -d rag-service
```

## Bước 5 — Kiểm tra health

```bash
curl http://localhost:8081/health
curl http://localhost:8082/health
curl http://localhost:8083/health
```

Kiểm tra thêm `rag-service` nhìn thấy Ollama từ trong container:

```bash
docker compose exec -T rag-service sh -lc "curl http://host.docker.internal:11435/api/tags"
```

Nếu lệnh này fail thì chat sẽ trả `Unable to generate a response`.

## Bước 6 — Kiểm tra log đã lên CUDA

```bash
docker compose logs rag-service | grep -i -E "cuda|gpu|device"
docker compose logs ingestion-service | grep -i -E "cuda|gpu|device"
```

## Bước 7 — Mở UI

- http://localhost:3001

---

## 4) Dùng lần đầu trên UI

## 4.1 Tạo workspace

1. Mở UI: http://localhost:3001
2. Vào tab **Workspaces**
3. Bấm **New Workspace** hoặc tạo workspace từ form

## 4.2 Upload + Index tài liệu

1. Vào **Documents** của workspace vừa tạo
2. Upload 1 file nhỏ trước (TXT/MD/PDF nhỏ)
3. Bấm **Analyze** để bắt đầu parse/index
4. Chờ trạng thái chuyển sang `INDEXED`

> Nếu chỉ upload mà chưa Analyze thì chat chưa có ngữ cảnh tài liệu.

## 4.3 Chat đúng cách

1. Vào **Chat** của đúng workspace
2. Gõ câu hỏi liên quan tài liệu vừa index
3. Bấm **Send** (hoặc Enter)
4. Quan sát:
	 - khung trả lời chính
	 - panel **Sources** (nguồn chunk)
	 - panel **Thinking**

Nếu chat trả `Unable to generate a response`, kiểm tra lại:

```bash
curl http://localhost:11435/api/tags
docker compose exec -T rag-service sh -lc "curl http://host.docker.internal:11435/api/tags"
docker compose restart rag-service
```

## 4.4 Smoke test API chat nhanh (không qua UI)

```bash
curl -X POST http://localhost:8081/api/v1/rag/chat/<WORKSPACE_ID> \
	-H "Content-Type: application/json" \
	-d '{"message":"Tóm tắt tài liệu","history":[],"enable_thinking":false}'
```

## 4.5 Test indexing 1 lệnh (không cần tự lấy workspace_id/document_id)

Endpoint mới ở `ingestion-service`:

- `POST /api/v1/ingest/easy-index`

Ví dụ upload + index + chờ kết quả luôn:

```bash
curl -X POST http://localhost:8082/api/v1/ingest/easy-index \
	-F "file=@/duong_dan/test.pdf" \
	-F "workspace_name=test-mineru" \
	-F "auto_create_workspace=true" \
	-F "wait_for_index=true" \
	-F "timeout_seconds=240"
```

Kết quả trả về luôn:

- `workspace_id`
- `document_id`
- `status` (`indexed` / `failed` / `processing`)
- `chunk_count`, `error_message` (nếu có)

Nếu muốn fire-and-forget (không chờ index xong):

```bash
curl -X POST http://localhost:8082/api/v1/ingest/easy-index \
	-F "file=@/duong_dan/test.pdf" \
	-F "workspace_name=test-mineru" \
	-F "wait_for_index=false"
```

Sau đó poll trạng thái:

```bash
curl http://localhost:8082/api/v1/ingest/status/<DOCUMENT_ID>
```

---

## 5) Luồng dữ liệu thực tế

1. `ingestion-service` nhận file
2. Parse Docling
3. Chunk + embedding (**GPU**)  
4. Lưu vector vào PostgreSQL (`pgvector`)
5. `rag-service` retrieve từ pgvector + KG
6. Rerank (**GPU**)
7. Gọi Ollama (**GPU**)
8. Trả kết quả về frontend

---

## 6) Lỗi thường gặp và xử lý nhanh

## Lỗi A: Chat timeout / không trả lời

```bash
ollama ps
ollama pull qwen3:8b
curl http://localhost:11435/api/tags
docker compose exec -T rag-service sh -lc "curl http://host.docker.internal:11435/api/tags"
docker compose restart rag-service
```

## Lỗi B: Upload không lên INDEXED

```bash
docker compose logs -f ingestion-service
```

## Lỗi C: Container không thấy GPU

```bash
docker run --rm --gpus all nvidia/cuda:12.3.2-base-ubuntu22.04 nvidia-smi
```

Nếu fail: sửa/cài NVIDIA Container Toolkit rồi chạy lại.

## Lỗi D: Lỗi pgvector

```bash
docker compose down -v
docker compose up -d
```

Nếu gặp lỗi image not found kiểu `ankane/pgvector:pg15` thì dùng image đúng trong compose:

- `pgvector/pgvector:pg15`

## Lỗi E: `No space left on device`

Triệu chứng:
- Upload/chat đột nhiên 500
- Postgres báo panic/recovery loop

Xử lý:

```bash
df -h /
docker system prune -af
docker compose restart postgres rag-service ingestion-service kg-service
```

---

## 7) Nếu vẫn ngốn VRAM

Giảm tải theo thứ tự:

1. Giữ `qwen3:8b` (nếu OOM thì hạ về `qwen2.5:3b`)
2. Tắt KG tạm để test chat nhanh:

```dotenv
CUONGRAG_ENABLE_KG=false
```

3. Restart service:

```bash
docker compose restart rag-service ingestion-service kg-service
```

---

## 8) Lệnh nhanh mỗi ngày

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

## 9) Kết luận

Chế độ hiện tại đúng yêu cầu của bạn:

- **All-GPU test mode** (LLM + embedding + reranker)
- **pgvector trong PostgreSQL**
- **tối ưu để chạy nhanh và ổn định trên 12GB VRAM**

Khi test xong, bạn có thể đổi lại model chuẩn/production sau.