# CuongRAG - Phân Tích Tổng Quát Hệ Thống

Dựa trên cấu trúc và tài liệu của repository, hệ thống **CuongRAG** là một nền tảng RAG (Retrieval-Augmented Generation) xây dựng theo mô hình Microservices, tối ưu hóa để chạy nội bộ (local) trên máy tính có VRAM thấp bằng cách áp dụng phương pháp gọi API-first cho phần lớn các tác vụ AI (thông qua FPT Cloud API).

Hệ thống được chia thành 4 thành phần chính hoạt động độc lập và giao tiếp với nhau qua chung Database và thư mục dữ liệu, được điều phối bằng Docker Compose.

---

## 1. Thành Phần Hệ Thống (Microservices)

### 1.1. Ingestion Service (Dịch vụ xử lý tài liệu)
- **Vị trí**: `ingestion-service/`
- **Cổng**: 8082
- **Nhiệm vụ**: Chịu trách nhiệm nhận file upload, bóc tách và số hóa dữ liệu.
- **Hoạt động chính**:
  1. Nhận tài liệu (PDF, Word, TXT,...) và lưu trữ vào thư mục `.data/uploads`.
  2. Quản lý trạng thái xử lý bất đồng bộ (PENDING -> PARSING -> INDEXING -> INDEXED).
  3. Thực hiện bóc tách Layout tài liệu bằng Docling/MinerU (chạy cục bộ bằng GPU).
  4. Trích xuất văn bản, bảng biểu, ảnh và chuyển thành định dạng Markdown.
  5. Cắt nhỏ văn bản (Chunking), mã hóa vector (Embedding API 1024d) và lưu vào cơ sở dữ liệu `vector_chunks`.
  6. Tích hợp gọi Knowledge Graph Service (KG) để trích xuất thực thể.

### 1.2. RAG Service (Dịch vụ Chat và Truy vấn)
- **Vị trí**: `rag-service/`
- **Cổng**: 8081
- **Nhiệm vụ**: Xử lý luồng hội thoại với người dùng, truy xuất dữ liệu và sinh câu trả lời.
- **Hoạt động chính**:
  1. Quản lý Workspaces (Cấu hình độc lập system prompt, knowledge base).
  2. Tiếp nhận câu hỏi người dùng, thực hiện tạo embedding cho câu hỏi.
  3. Tiến hành tìm kiếm lai (Hybrid Search): Vector Search (trên `vector_chunks`) kết hợp với Graph Search (trên Knowledge Graph).
  4. Sắp xếp lại kết quả bằng Reranker API để tăng độ chính xác (Cross-encoder rerank).
  5. Ghép ngữ cảnh (context), hình ảnh trích xuất và đưa vào prompt để gọi LLM (Large Language Model) sinh câu trả lời.
  6. Trả kết quả dạng Streaming SSE (Server-Sent Events) có đính kèm nguồn trích dẫn, ảnh, bảng...
  7. Lưu lại lịch sử hội thoại `chat_messages`.

### 1.3. KG Service (Dịch vụ Knowledge Graph)
- **Vị trí**: `kg-service/`
- **Cổng**: 8083
- **Nhiệm vụ**: Trích xuất, xây dựng và truy vấn Đồ thị Tri thức (Knowledge Graph) theo từng Workspace.
- **Hoạt động chính**:
  1. Lấy dữ liệu các chunk văn bản, gọi LLM API để trích xuất các Thực thể (Entities) và Quan hệ (Relationships) bằng cơ chế LightRAG.
  2. Lưu trữ các node và edge vào Database (`kg_nodes`, `kg_edges`).
  3. Khi RAG Service cần, KG Service cung cấp đồ thị con (subgraph) liên quan đến câu hỏi.

### 1.4. Frontend (Giao diện người dùng)
- **Vị trí**: `frontend/`
- **Cổng**: 3001
- **Công nghệ**: React, Vite, TailwindCSS
- **Nhiệm vụ**: Cung cấp giao diện tương tác (Upload tài liệu, Chatbot, Quản lý Workspace).
- Hiển thị trực quan luồng văn bản, suy nghĩ (thinking), hình ảnh, bảng biểu và quản lý trạng thái tải lên.

---

## 2. Lớp Dữ Liệu và Hạ Tầng (Data Layer)

- **PostgreSQL + pgvector**: Đây là trái tim của hệ thống lưu trữ tập trung (Database chung cho tất cả service). Chạy ở cổng `5435`.
  - Lưu cấu hình Workspace.
  - Lưu thông tin Metadata của files, Lịch sử chat.
  - Lưu Vector Embedding với tiện ích `pgvector` phục vụ so khớp vector.
  - Lưu các bảng đồ thị tri thức (KG).
- **Thư mục chia sẻ (`.data/`)**: Thư mục vật lý map chung với tất cả services:
  - `uploads/`: Nơi chứa file gốc.
  - `docling/`: Lưu ảnh trang tài liệu, bảng biểu trích xuất.
  - `lightrag/`: Lưu file GraphML offline.

---

## 3. Các API & Mô Hình AI Cốt Lõi
Hệ thống kết hợp giữa tính toán Local và Cloud API:
- **Local / Containerize**: Dùng Docling (Python OCR GPU) bóc tách tài liệu. Database PostgreSQL lưu trữ.
- **FPT Cloud API (External)**: 
  - **Embedding**: Mô hình Vietnamese embedding 1024 chiều.
  - **Vision / LLM**: Mô hình Qwen2.5-VL-7B (caption ảnh) & Qwen3-32B / Gemini (tạo câu trả lời và trích xuất KG).
  - **Reranker**: bge-reranker-v2-m3 để chấm điểm ngữ cảnh.
