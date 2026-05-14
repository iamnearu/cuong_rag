# Thuyết Trình: Luồng hoạt động khi người dùng hỏi "abc"

Mục tiêu: Trình bày rõ ràng từng bước luồng dữ liệu và các kỹ thuật chính khi một người dùng hỏi "abc" trong hệ thống CuongRAG. Giọng điệu: thuyết trình trước giáo viên — rõ ràng, có ví dụ và giải thích kỹ thuật.

---

## Tóm tắt luồng cao level

Khi người dùng gửi câu hỏi "abc", hệ thống thực hiện hai luồng chính tùy theo trạng thái dữ liệu:

- Nếu tài liệu liên quan chưa được ingest (chưa có trong hệ thống): thực hiện luồng Ingestion (upload → OCR → hậu xử lý → chunking → embedding → index).
- Nếu tài liệu đã được ingest: thực hiện luồng Chat/Retrieval (embed câu hỏi → tìm kiếm vector + KG → rerank → build prompt → gọi LLM → stream trả lời).

Chúng ta sẽ đi chi tiết từng bước, giải thích kỹ thuật (Docling OCR, chunking, embedding, pgvector, reranker, prompt engineering, streaming)

---

## Kịch bản ví dụ: Người dùng hỏi "abc"

Giả sử workspace `WS1` đã chứa một bộ tài liệu liên quan. Người dùng trong giao diện frontend nhập: "abc" → nhấn gửi.

1) Frontend gửi HTTP POST tới endpoint chat stream của RAG service: `/api/v1/rag/chat/{workspace_id}/stream` với body chứa `message: "abc"` và `history` (nếu có).

2) RAG service bắt request, tạo một phiên truy vấn và gọi component DeepRetriever để thu thập bằng chứng (evidence).

3) DeepRetriever chạy song song:
   - Vector search: embed câu hỏi → truy vấn `vector_chunks` trên PostgreSQL + pgvector để lấy N kết quả thô.
   - KG query (nếu KG bật): hỏi LightRAG để lấy entity/đường dẫn liên quan.

4) Kết quả thô (ví dụ 30 chunk) được gửi cho Reranker (cross-encoder) để chọn top_k (ví dụ 8) chunks có liên quan nhất.

5) RAG service build prompt: đưa các `chunks` (kèm metadata: id, trang, document) vào phần nguồn, thêm quy tắc trả lời (không bịa đặt, chỉ trích dẫn), rồi gọi LLM để stream phản hồi về frontend.

6) Kết quả cuối cùng được lưu vào bảng `chat_messages` cùng danh sách nguồn (sources) để hiển thị citations.

---

## Nếu tài liệu chưa được ingest — Luồng Ingestion (chi tiết kỹ thuật)

1) Upload & Lưu trữ
   - Frontend POST file tới `ingestion-service`.
   - File được lưu vào `.data/uploads/{workspace_id}/` và tạo record `documents` với trạng thái `PENDING`.

2) OCR & Layout Analysis (Docling)
   - Docling thực hiện phân tách layout: nhận diện page, text block, headings, tables, figures.
   - Kết quả: văn bản thô (OCR text) theo khối, ảnh (cropped images), metadata vị trí (bbox), và bảng (table extraction).
   - Những kỹ thuật chính: OCR kết hợp mô hình phân đoạn layout (CNN/Transformer), bước tiền xử lý ảnh (binarization, deskew), và post-OCR correction (language model cho sửa lỗi chữ).

3) Hậu xử lý văn bản
   - Loại bỏ header/footer, số trang lặp, watermark; chuẩn hoá encoding và dấu câu; nhận diện ngôn ngữ.
   - Áp dụng rule-based + regex để fix common OCR artifacts (ghép từ bị tách, chữ sai ký tự).

4) Chunking (phân đoạn nội dung)
   - Mục tiêu: chia tài liệu thành các đoạn nhỏ đủ ngữ cảnh để embed và trả lời câu hỏi.
   - Chiến lược phổ biến:
     - Fixed-token chunks: chia theo số token (ví dụ ~512 tokens) với overlap (ví dụ 50–128 tokens) để giữ ngữ cảnh liên tục.
     - Semantic/sentence-aware chunking: tách theo câu/đoạn, dùng sentence boundary detection, sau đó gộp cho đủ kích thước target.
     - Hierarchical chunking: tạo chunk nhỏ (sentences) và chunk lớn (section-level) để hỗ trợ retrieval đa granular.
   - Metadata: mỗi chunk kèm `chunk_id`, `document_id`, `page_no`, `heading_path`, `char_range`.

5) Dedup & Filter
   - Loại bỏ đoạn trùng lặp bằng checksum/text-similarity; loại bỏ noise (trang mục lục, phụ lục không có nội dung hữu ích).

6) Embedding
   - Mục tiêu: ánh xạ đoạn văn bản sang vector số trong không gian nhúng.
   - Mô hình: tùy hệ thống — có thể dùng FPT Cloud embedding (1024-dim), hoặc sentence-transformers (768/1024), hoặc OpenAI embeddings.
   - Kỹ thuật: tokenizer → model inference (batching để tăng throughput) → L2-normalize hoặc cosine-normalize vectors (tuỳ metric).
   - Lưu ý: cache embeddings cho chunk không đổi; xử lý incremental update khi tài liệu thay đổi.

7) Lưu vào CSDL (Postgres + pgvector)
   - Bảng `vector_chunks` chứa: `workspace_id`, `chunk_id`, `document`, `embedding` (VECTOR), `metadata_json`, `document_id`.
   - Việc lưu kèm metadata cho phép trích dẫn nguồn và hiển thị page/ảnh tương ứng.

---

## Embedding: kỹ thuật và vận hành

- Mục tiêu: biểu diễn ngữ nghĩa để so sánh similarity.
- Các lựa chọn mô hình: transformer-based sentence encoders (SBERT family), API providers (FPT Cloud, OpenAI, etc.).
- Thiết kế vận hành:
  - Batch inference để giảm latency-amortized cost.
  - Normalize vectors nếu dùng cosine similarity.
  - Chiến lược dimension: 512/768/1024 là phổ biến; dimension cao giúp biểu diễn chi tiết nhưng tốn bộ nhớ.
  - Handling OOV/rare tokens: tokenizer dựa trên subword giúp robust với tên riêng/từ kỹ thuật.

---

## pgvector & lưu trữ tìm kiếm tương đồng

- `pgvector` là extension cho PostgreSQL để lưu và truy vấn vector.
- Cột vector: định nghĩa loại vector (ví dụ `vector(1024)`).
- Truy vấn tương đồng:
  - Inner product / Cosine / Euclidean (L2) — chọn metric phù hợp với cách embeddings được train.
  - SQL example: `SELECT *, embedding <=> query_vec AS distance FROM vector_chunks ORDER BY distance LIMIT 30;`
- Indexing cho tốc độ:
  - `ivfflat` (inverted file) cho approximate nearest neighbors (ANN) — cần `ANN` index build phase và cấu hình `lists`.
  - `hnsw` (hierarchical navigable small world) cho perform tốt với insert runtime thấp và latency thấp.
  - Chọn index tuỳ tradeoff: throughput vs chất lượng.

---

## Reranker (cross-encoder)

- Lý do: vector search nhanh nhưng đôi khi trả về chunk có từ vựng gần nhưng không trả lời tốt.
- Cross-encoder (bi-encoder vs cross-encoder): cross-encoder nhận cặp (query, chunk) và cho điểm trực tiếp, thường chính xác hơn nhưng tốn chi phí.
- Workflow: lấy top N ~30 từ vector search → chạy reranker → chọn top_k final (ví dụ 8).

---

## Prompt building & LLM streaming

- System prompt: định nghĩa vai trò (trợ lý tra cứu), quy tắc (chỉ dùng nguồn, trích dẫn rõ ràng).
- Context: chèn các `chunks` đã rerank, kèm nhãn tham chiếu `[a3x9]` + trang.
- LLM: gọi model stream (Gemini / Ollama), truyền prompt lớn (tối ưu bằng prompt windowing nếu context quá lớn).
- Streaming: trả token từng chút, gửi về frontend qua SSE/WebSocket để hiển thị realtime.

---

## Lưu lịch sử và trích dẫn

- Sau khi có phản hồi, lưu `ChatMessage` với `role`, `content`, `sources` (list of chunk ids + page_nos).
- Frontend sử dụng `sources` để hiển thị citation, link đến ảnh/bảng tương ứng.

---

## Ví dụ minh hoạ ngắn (từng bước) — câu hỏi: "abc"

1) User → frontend → POST `/chat/{ws}/stream` với "abc".
2) RAG service embed "abc" → vector search top30 → KG query.
3) Reranker chạy trên 30 → chọn 8.
4) Build prompt (8 chunks + rules) → gọi LLM → stream trả lời: "..." + [ref ids].
5) Lưu `chat_messages` kèm sources.

---

## Kết luận — Những điểm quan trọng để trình bày trước giáo viên

- Nhấn mạnh tính chuỗi: OCR → chunking → embedding → vector index → rerank → LLM.
- Giải thích tradeoffs: tốc độ vs độ chính xác (bi-encoder nhanh, cross-encoder chính xác), dimension embedding vs bộ nhớ, index type vs latency.
- Cho ví dụ thực tế: chiến lược chunking có overlap giúp tránh mất ngữ cảnh khi câu hỏi rơi giữa hai chunk.

Nếu thầy/cô muốn, em có thể bổ sung sơ đồ tuần tự hoặc ví dụ cụ thể trích xuất từ một file PDF mẫu.
