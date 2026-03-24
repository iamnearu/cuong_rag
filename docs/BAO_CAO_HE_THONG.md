# BÁO CÁO TỔNG QUAN: MÔ TẢ VÀ ĐÁNH GIÁ HỆ THỐNG RAG & OCR

## 1. Tổng quan hệ thống
Hệ thống là một giải pháp toàn diện kết hợp giữa Trích xuất thông tin tài liệu chuyên sâu (Advanced OCR) và Truy xuất thông tin thông minh (RAG - Retrieval-Augmented Generation) kết hợp Đồ thị tri thức (Knowledge Graph - GraphRAG). 

Hệ thống được thiết kế theo kiến trúc **Microservices** để đảm bảo tính mở rộng, tách biệt rõ ràng các luồng xử lý nặng (như bóc tách tài liệu bằng AI) và luồng phục vụ người dùng (như Chatbot, UI).

---

## 2. Công nghệ sử dụng (Dùng gì?)

Hệ thống sử dụng các công cụ và framework tiên tiến nhất hiện nay, chia theo từng phân hệ:

### 2.1. Phân hệ Frontend (Giao diện người dùng)
*   **ReactJS & Vite:** Xây dựng giao diện Single Page Application (SPA) tốc độ cao.
*   **TailwindCSS / Radix UI:** Hệ thống thiết kế UI tinh gọn, giao diện chat thân thiện.

### 2.2. Phân hệ RAG & API Services (Backend)
*   **FastAPI:** Framework chính cho toàn bộ các microservices (RAG Service, Ingestion Service, KG Service).
*   **PostgreSQL & pgvector:** Cơ sở dữ liệu chính lưu trữ metadata và vector nhúng (vector embeddings) phục vụ truy vấn ngữ nghĩa (Semantic Search).
*   **LLM Providers:** Hỗ trợ chạy nội bộ (Local) với **Ollama** (Qwen, Gemma) hoặc qua API đám mây (**Google Gemini**).
*   **Sentence-Transformers (BAAI/bge-m3):** Mô hình nhúng (Embedding Model) đa ngôn ngữ.
*   **LightRAG:** Khung xây dựng và truy vấn Đồ thị tri thức (Knowledge Graph).

### 2.3. Phân hệ Xử lý tài liệu & OCR (OCR Services)
*   **RabbitMQ & Celery:** Hệ thống Message Broker và Task Queue để quản lý hàng đợi, xử lý bất đồng bộ các tài liệu nặng.
*   **MinIO / S3:** Object storage lưu trữ tệp gốc và ảnh được bóc tách từ tài liệu.
*   **Engine bóc tách (Parsing Providers):** 
    *   **MinerU:** Bóc tách cấu trúc PDF, giữ nguyên định dạng toán học, bảng biểu.
    *   **Docling:** Hỗ trợ parse nhanh các tài liệu văn bản thông thường.
    *   **DeepSeek / Qwen2-VL:** Mô hình Vision-Language hỗ trợ đọc và giải thích ảnh/bảng biểu.
*   **Mô hình hiệu đính (Post-processing):** Mô hình **ProtonX** (tinh chỉnh) dùng để hiệu đính chính tả và sửa lỗi văn bản sau OCR (đặc biệt cho tiếng Việt).

---

## 3. Logic xử lý từng phần (Logic ra sao?)

Kiến trúc hệ thống được chia thành 3 luồng logic chính:

### Phân hệ 1: Luồng Xử lý tải lên và Bóc tách tài liệu (Ingestion & OCR Pipeline)
1. **Tiếp nhận:** Người dùng tải file (PDF, DOCX, MD) qua Frontend, gửi đến `ingestion-service`.
2. **Đẩy vào Hàng đợi:** Tệp được lưu trữ và một thông điệp (message) sinh ra đẩy vào RabbitMQ để không làm treo hệ thống.
3. **Phân tích (Celery Workers):** 
   *    Các worker (MinerU, Docling) nhận task từ RabbitMQ. 
   *    Tiến hành bóc tách cấu trúc (Layout analysis), cắt riêng biểu đồ, công thức toán học và đoạn văn.
   *    Nếu có ảnh phức tạp, các worker DeepSeek/Qwen2 VLM sẽ tham gia mô tả ảnh.
4. **Hiệu đính (Correction):** Văn bản thô sau khi OCR thường bị lỗi tiếng Việt hoặc mất chữ. Text được chạy qua module `vn_model_corrector` (ProtonX models) để làm sạch và khôi phục ngữ nghĩa.
5. **Đóng gói định dạng:** Toàn bộ đầu ra được quy hoạch lại thành định dạng Markdown chuẩn hóa (`postprocess_md.py`) và trả kết quả về Ingestion Service.

### Phân hệ 2: Luồng Chunking & Lưu trữ Vector + Tri thức (Data Indexing)
1. **Chia nhỏ (Chunking):** Markdown từ luồng OCR được chia thành các đoạn văn nhỏ (Chunks) đảm bảo không bị rách đoạn văn hay mất ngữ cảnh (dùng `langchain-text-splitters`).
2. **Nhúng Vector (Embedding):** RAG Service dùng mô hình Sentence-Transformers chuyển đổi từng Chunk thành Vector biểu diễn ngữ nghĩa chứa ý nghĩa của đoạn văn đó.
3. **Trích xuất Đồ thị tri thức (KG Service):** Đồng thời, tài liệu cũng được đẩy qua `kg-service` để tự động dò tìm các Thực thể (Entities) và Mối quan hệ (Relationships) tạo thành một cấu trúc mạng nhện tri thức (Knowledge Graph - sử dụng LightRAG).
4. **Cơ sở dữ liệu:** Vectors lưu vào `pgvector`, dữ liệu đồ thị lưu vào bảng metadata chuyên dụng, sẵn sàng cho truy vấn.

### Phân hệ 3: Luồng Khai thác & Trả lời (Chat & Retrieval)
1. **Tiếp nhận truy vấn:** Người dùng gõ câu hỏi vào khung Chat.
2. **Tìm kiếm (Retrieval):** 
    *   *Semantic Search:* Chuyển câu hỏi ở dạng text thành vector, tìm các Chunks có độ tương đồng cosine (Cosine Similarity) cao nhất trong PostgreSQL.
    *   *Graph Search:* Lấy các thực thể trong câu hỏi, tra cứu Đồ thị tri thức (KG) để tìm mối liên hệ ngữ cảnh mở rộng.
3. **Reranking (Xếp hạng lại):** Nhóm các chunk và kết quả Graph tìm được, chấm điểm lại bằng Cross-Encoder để chọn ra Top K nội dung sát với câu hỏi nhất, loại bỏ nhiễu.
4. **Sinh câu trả lời (Generation):** Hệ thống ghép (Prompt Injection) Top K nội dung ngữ cảnh này cùng với câu hỏi của người dùng gửi cho LLM (Ollama/Gemini).
5. **Streaming trả về:** LLM suy luận và stream từng từ (token) qua chuẩn Server-Sent Events (SSE) về lại giao diện React, kèm theo trích dẫn (Citations) chính xác từ file nào, dòng/trang nào.

---

## 4. Kết quả đánh giá

> ***[GHI CHÚ DÀNH CHO BẠN: Hãy chèn phần nội dung đánh giá mà bạn đã tự viết vào khu vực này. Bao gồm các thông số, biểu đồ, nhận xét về độ chính xác của OCR, RAG hoặc trải nghiệm người dùng...]***

* (Ví dụ: Độ chính xác của MinerU khi parse PDF tiếng Việt đạt: XX%)
* (Ví dụ: Thời gian trích xuất và sinh câu trả lời trung bình: Y.Y giây)
* (Ví dụ: Đánh giá chất lượng sinh câu trả lời (Faithfulness / Answer Relevance) đạt ngữ cảnh tốt...)

---
*Tài liệu được trích xuất từ cấu trúc thiết kế dự án CMMS RAG Copilot hiện tại.*
