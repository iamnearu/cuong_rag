# Tài liệu tối ưu & mở rộng hệ thống trong tương lai

Ngày cập nhật: 2026-03-19
Phạm vi tham khảo: `cuong_rag` + `NexusRAG` + `rag-service` + `ocr_services` + `speedmaint-ui` + `api_gateway`

---

## 1) Mục tiêu tài liệu

Tài liệu này tổng hợp các **option mở rộng** cho hệ thống của bạn theo 3 trục chính:

1. **Model stack có thể thay thế** (LLM / embedding / reranker / OCR / KG)
2. **Tối ưu giao diện và trải nghiệm người dùng**
3. **Mở rộng kiến trúc để scale ổn định**

Mục tiêu: giúp bạn có lộ trình nâng cấp dần, không phá vỡ hệ thống đang chạy.

---

## 2) Hiện trạng nhanh (baseline)

### Trong `cuong_rag` hiện tại

- LLM chat qua Ollama (`OLLAMA_MODEL`, đang dùng `qwen3:8b`)
- Vector embedding: `sentence-transformers/all-MiniLM-L6-v2`
- Reranker: `cross-encoder/ms-marco-MiniLM-L-6-v2`
- KG embedding: `BAAI/bge-m3`
- OCR engine: `docling` (có nhánh `mineru`)
- Retrieval: vector + KG + rerank

### Điểm nghẽn đã thấy thực tế

- Kết nối Ollama dễ lỗi nếu proxy host không chạy
- KG extraction có thể timeout khi model nhỏ hoặc tải GPU cao
- API test indexing trước đây phức tạp (đã cải thiện bằng `easy-index`)
- UI chat chưa hiển thị score chi tiết theo từng source

---

## 3) Option model có thể thay thế (khuyến nghị theo bài toán)

## 3.1 Chat LLM (Ollama/Gemini)

### Option local (Ollama)

- `qwen3:8b` → cân bằng tốt cho 12GB VRAM (đang dùng)
- `qwen2.5:7b` → nhẹ hơn, ổn định tool-calling ở mức khá
- `gemma3:12b` → chất lượng trả lời/KG thường tốt hơn, nhưng nặng hơn

### Option cloud

- `gemini-2.5-flash` hoặc `gemini-3.x flash-lite` cho throughput cao, giảm tải hạ tầng local

### Khi nào đổi model chat?

- KG ra ít entity/relationship hoặc câu trả lời không bám nguồn: nâng model chat
- OOM/latency cao: hạ model hoặc chuyển cloud

---

## 3.2 Embedding model (vector retrieval)

### Option hiện có trong repo tham khảo

- `sentence-transformers/all-MiniLM-L6-v2` (384d): nhẹ, nhanh
- `BAAI/bge-m3` (1024d): chất lượng multilingual tốt hơn

### Khuyến nghị

- Giai đoạn test tốc độ: giữ MiniLM
- Giai đoạn production/tìm kiếm khó: chuyển `bge-m3` cho vector retrieval

> Lưu ý migration: đổi embedding dimension cần re-index toàn bộ chunk.

---

## 3.3 KG embedding

Từ `NexusRAG`/`cuong_rag`, bạn có 3 nhóm:

- `sentence_transformers` (fully local)
- `ollama` embedding
- `gemini` embedding (cloud)

Khuyến nghị:

- Local/offline: `sentence_transformers + bge-m3`
- Chất lượng KG cao nhất: Gemini embedding

---

## 3.4 Reranker

Option chính trong các repo:

- `cross-encoder/ms-marco-MiniLM-L-6-v2` (nhẹ)
- `BAAI/bge-reranker-v2-m3` (chất lượng cao hơn)

Khuyến nghị:

- Nếu câu trả lời sai ngữ cảnh dù retrieve đúng top-k: ưu tiên nâng reranker trước khi tăng LLM.

---

## 3.5 OCR engine / parsing

Từ `ocr_services`:

- `docling` (ổn định, dễ chạy)
- `mineru` (mạnh cho PDF OCR phức tạp)
- `deepseek` OCR (pipeline riêng qua worker)

Khuyến nghị triển khai:

- Default: `docling`
- Fallback/quality mode: `mineru`
- Với tài liệu scan khó: route sang hàng đợi OCR chuyên dụng (`ocr_services`)

---

## 3.6 VLM cho image captioning

Từ `rag-service` tham khảo:

- `qwen3-vl:8b-*` cho phân tích ảnh/tables tốt hơn khi bật image captioning

Khuyến nghị:

- Bật VLM theo workspace hoặc theo loại tài liệu để tối ưu chi phí.

---

## 4) Profile cấu hình đề xuất (để chuyển nhanh)

## Profile A — Local Balanced (12GB VRAM)

- Chat: `qwen3:8b`
- Vector embedding: `all-MiniLM-L6-v2`
- KG embedding: `bge-m3`
- Reranker: `ms-marco-MiniLM-L-6-v2`
- OCR: `docling`
- KG: bật, nhưng có timeout guard

Dùng khi: cần chạy ổn định, chi phí thấp, vẫn có KG.

## Profile B — Quality First

- Chat: `gemma3:12b` hoặc Gemini Flash
- Vector embedding: `bge-m3`
- KG embedding: Gemini embedding
- Reranker: `bge-reranker-v2-m3`
- OCR: `docling + mineru fallback`

Dùng khi: ưu tiên chất lượng trả lời/citation/KG.

## Profile C — Throughput First

- Chat: Gemini Flash-lite
- Vector embedding: MiniLM
- KG: tắt hoặc chạy async batch
- OCR: docling only

Dùng khi: nhiều user đồng thời, ưu tiên latency.

---

## 5) Tối ưu giao diện (tham khảo từ `NexusRAG` + `speedmaint-ui`)

## 5.1 Chat UX cần ưu tiên

1. Hiển thị rõ pipeline trạng thái: retrieve -> rerank -> generate
2. Hiển thị `score` cho từng source chunk (hiện backend có log nhưng UI chưa show đủ)
3. Cho phép bật/tắt panel `Thinking`, `Sources`, `Images`
4. Retry nhanh cho lỗi LLM connection ngay trong UI

## 5.2 Document UX

1. Bộ lọc tài liệu theo `status`, `parser`, `time`, `workspace`
2. Hiển thị tiến trình indexing theo stage (upload/parsing/indexing/kg)
3. Viewer có jump-to-page từ citation badge

## 5.3 KG UX

1. Graph view có zoom/pan/select entity
2. Highlight đường đi entity liên quan câu trả lời
3. Cho phép chuyển mode query: local/global/hybrid/mix

## 5.4 Performance frontend

1. Virtual list cho chat/source dài
2. Cache dữ liệu theo workspace (React Query pattern)
3. Debounce search/filter
4. Tách component nặng (graph, markdown) + memo

---

## 6) Mở rộng kiến trúc hệ thống

## 6.1 Mẫu kiến trúc mục tiêu

- `api_gateway` làm lớp auth/multi-tenant/rate limit/audit
- `ingestion-service` chuyên upload/parse/index
- `rag-service` chuyên retrieval + generation
- `kg-service` tách riêng để scale độc lập
- `ocr_services` làm hàng đợi OCR chuyên dụng cho tài liệu nặng

## 6.2 Chiến lược scale

1. Scale ngang theo service (`rag-service` và `ingestion-service` trước)
2. Tách queue cho ingestion batch và OCR batch
3. Dùng circuit-breaker cho call Ollama/LLM provider
4. Có fallback model khi model chính timeout

## 6.3 Quan sát vận hành (observability)

Bắt buộc thêm:

- Metrics: request latency, token usage, retrieval hit-rate, rerank latency, OCR time
- Structured logs theo `workspace_id`, `document_id`, `request_id`
- Dashboard lỗi top N theo service
- Alert khi:
  - Ollama unreachable
  - queue backlog tăng
  - tỷ lệ `Unable to generate a response` vượt ngưỡng

---

## 7) Backlog kỹ thuật ưu tiên (roadmap đề xuất)

## Giai đoạn 1 (1-2 tuần): ổn định vận hành

- [ ] Auto-check Ollama proxy khi startup
- [ ] Health endpoint kiểm tra downstream (Ollama, DB, vector)
- [ ] Hiển thị score source ở chat response
- [ ] Chuẩn hóa profile `.env` theo A/B/C

## Giai đoạn 2 (2-4 tuần): nâng chất lượng trả lời

- [ ] Chuyển reranker sang `bge-reranker-v2-m3` (A/B test)
- [ ] Bật fallback OCR (`docling` -> `mineru`)
- [ ] Cải thiện chunk strategy theo loại tài liệu

## Giai đoạn 3 (1-2 tháng): mở rộng kiến trúc

- [ ] Đưa auth + tenancy qua `api_gateway`
- [ ] Tích hợp `ocr_services` queue mode cho tài liệu lớn
- [ ] Dashboard quan sát tập trung
- [ ] Canary deploy cho model thay đổi

---

## 8) Quy tắc thay model an toàn

1. Không đổi nhiều thành phần cùng lúc (LLM + embedding + reranker) trong một lần release
2. Mỗi lần đổi model phải có benchmark trước/sau:
   - latency
   - citation precision
   - answer correctness
3. Đổi embedding dimension -> bắt buộc re-index
4. Luôn có model fallback trong `.env`

---

## 9) Kết luận

Hệ thống hiện tại đã có nền tảng tốt để mở rộng. Đường nâng cấp hiệu quả nhất là:

1. **Ổn định kết nối & quan sát vận hành**
2. **Nâng reranker + chat model theo use-case**
3. **Chuẩn hóa gateway + OCR queue để scale thực tế**
4. **Tối ưu UI để người dùng nhìn rõ nguồn, score và trạng thái pipeline**

Nếu cần, bước tiếp theo tôi có thể viết thêm một file **“profile cấu hình sẵn dùng”** (A/B/C) để bạn copy vào `.env` và chạy ngay.