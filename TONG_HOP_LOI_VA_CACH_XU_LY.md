# Tổng hợp lỗi đã gặp và cách xử lý

Ngày cập nhật: 2026-03-19

## 1) Khó test API vì thiếu `workspace_id` và `document_id`

### Triệu chứng
- Test chat/indexing qua API bị vướng vì phải tự lấy `workspace_id`, rồi lại phải lấy tiếp `document_id`.
- Quy trình test thủ công dài, dễ sai.

### Nguyên nhân
- API cũ tách rời: upload -> process -> poll status, không có endpoint orchestration cho test nhanh.

### Cách đã xử lý
- Thêm endpoint một lệnh:
  - `POST /api/v1/ingest/easy-index`
- Endpoint mới làm luôn:
  1. Resolve/tạo workspace theo `workspace_name`
  2. Upload file
  3. Trigger indexing
  4. Có thể chờ đến `indexed/failed`
  5. Trả về ngay `workspace_id`, `document_id`, `status`, `chunk_count`, `error_message`

### File đã sửa
- ingestion-service/app/api/ingestion.py
- ingestion-service/app/api/router.py
- RUNBOOK_12GB_CAMTAY.md

---

## 2) API mới “không thấy” trên Swagger/OpenAPI

### Triệu chứng
- Không thấy `/api/v1/ingest/easy-index`, `/api/v1/workspaces`, `/api/v1/documents/...` trên `:8082/openapi.json`.

### Nguyên nhân
- Service đang chạy process cũ, chưa reload phần route mới.
- Có lúc thử build lại bị timeout mạng khi `pip install`, nên image mới không build xong.

### Cách đã xử lý
- Restart/recreate service đúng stack để nạp code mới (do đang bind mount source vào container).
- Kiểm tra lại `openapi.json` và xác nhận endpoint mới đã xuất hiện.

### Kết quả
- Đã có các route:
  - `/api/v1/ingest/easy-index`
  - `/api/v1/workspaces`
  - `/api/v1/documents/workspace/{workspace_id}`

---

## 3) LightRAG timeout khi dùng model nhỏ

### Triệu chứng
- Log ingestion báo:
  - `Worker execution timeout after 60s`
  - `TimeoutError: Embedding func: Worker execution timeout after 60s`
- Đồng thời vẫn có log parse/chunk/vector thành công.

### Nguyên nhân
- Nhánh KG (LightRAG) nặng hơn, dễ timeout với cấu hình/model nhỏ hoặc tải GPU cao.
- Đây là lỗi ở KG pipeline, không phải fail toàn bộ indexing tài liệu.

### Cách đã xử lý
- Giải thích rõ phạm vi lỗi: vector indexing vẫn thành công, lỗi nằm ở KG extraction.
- Đề xuất test mode ổn định: có thể tắt tạm KG nếu mục tiêu là kiểm tra luồng upload/index/chat nhanh.

### Ghi chú
- Warning `RapidOCR returned empty result` không nhất thiết làm hỏng toàn bộ pipeline.
- Warning token length > 512 là cảnh báo mô hình/chunker, không phải crash tức thì.

---

## 4) Đổi model Ollama lên `qwen3:8b`

### Yêu cầu
- Nâng từ model nhỏ lên `qwen3:8b` để tương thích tốt hơn cho thực tế chat/KG.

### Cách đã xử lý
- Cập nhật biến môi trường:
  - `.env`: `OLLAMA_MODEL=qwen3:8b`
  - `.env.example`: `OLLAMA_MODEL=qwen3:8b`
- Cập nhật tài liệu runbook sang `qwen3:8b`.
- Recreate backend services để nhận biến mới.
- Pull model thành công trên Ollama host.

### File đã sửa
- .env
- .env.example
- RUNBOOK_12GB_CAMTAY.md

---

## 5) Chat trả “Unable to generate a response” dù đã retrieve chunk

### Triệu chứng
- Log RAG có retrieve/rerank thành công (`Reranked 18 -> 8 chunks`).
- Nhưng LLM call lỗi:
  - `Failed to connect to Ollama`

### Nguyên nhân
- `rag-service` gọi `OLLAMA_HOST=http://host.docker.internal:11435`
- Nhưng proxy `11435` trên host không chạy tại thời điểm đó.

### Cách đã xử lý
- Kiểm tra `11434` (Ollama host) hoạt động bình thường.
- Dựng lại `ollama-proxy` để bridge `11435 -> 11434`.
- Xác nhận từ trong container gọi được `http://host.docker.internal:11435/api/tags`.
- Restart `rag-service` và test chat lại thành công.

### Kết quả
- Chat trả lời bình thường sau khi khôi phục proxy.

---

## 6) Về việc “chưa có score” ở response chat

### Quan sát
- Score reranker có trong log backend.
- Response chat/UI mặc định không luôn trả/hiển thị score chi tiết từng source.

### Hướng xử lý tiếp (nếu cần)
- Mở rộng response schema/API chat để trả thêm `score` cho từng source chunk.
- Frontend hiển thị score trong panel Sources.

---

## Checklist ổn định sau cùng

1. Ollama host chạy ở `127.0.0.1:11434`.
2. Proxy `ollama-proxy` chạy và mở `11435`.
3. `.env` dùng:
   - `LLM_PROVIDER=ollama`
   - `OLLAMA_HOST=http://host.docker.internal:11435`
   - `OLLAMA_MODEL=qwen3:8b`
4. Backend services đã recreate sau khi đổi `.env`.
5. Test nhanh:
   - `GET /health` cho 8081/8082/8083
   - `POST /api/v1/ingest/easy-index`
   - `POST /api/v1/rag/chat/{workspace_id}`

---

## Trạng thái hiện tại

- Indexing API đã dễ test hơn nhờ endpoint one-shot.
- Model đã chuyển sang `qwen3:8b`.
- Lỗi không kết nối Ollama đã xử lý xong.
- Hệ thống đang chạy được end-to-end (upload/index/retrieve/chat).