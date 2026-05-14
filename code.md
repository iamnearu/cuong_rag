# CuongRAG - Phân Tích Logic Mã Nguồn & Luồng Trả Lời Câu Hỏi

Văn bản này giải thích chi tiết luồng hoạt động dưới lớp code, từ lúc người dùng gửi tin nhắn trên giao diện đến khi mô hình sinh ra câu trả lời cuối cùng trên màn hình. Mọi xử lý liên quan đến truy vấn nằm phần lớn ở dịch vụ `rag-service`.

---

## 1. Người Dùng Nhập Câu Hỏi (Frontend -> RAG Service)

Khi bạn gõ câu hỏi vào ô chat và nhấn Gửi, Frontend sẽ khởi tạo một kết nối HTTP POST tới API Endpoint của `rag-service`:
- **API Endpoint**: `POST /api/v1/rag/chat/{workspace_id}/stream` (Định nghĩa tại `rag-service/app/api/router_v2.py`).
- **Giao thức Trả về**: **Server-Sent Events (SSE)**. Khác với API truyền thống trả 1 cục JSON, SSE cho phép server trả text liên tục theo thời gian thực (streaming) giúp tạo cảm giác mượt mà khi chatbot đang gõ.

## 2. Khởi tạo Agent Chat Streaming

Khi Request vào tới Router, hàm xử lý sẽ gọi trực tiếp đến hàm `agent_chat_stream()` được định nghĩa trong tệp `rag-service/app/api/chat_agent.py`.

**Hàm này khởi tạo các cấu trúc cốt lõi:**
1. Khởi tạo kết nối tới LLM (`provider.astream()`).
2. Lấy 10 tin nhắn lịch sử gần nhất để cấp ngữ cảnh cuộc trò chuyện.
3. Đóng gói System Prompt cấu hình riêng của từng Workspace (bao gồm thông tin yêu cầu phải gọi Tool tìm kiếm).
4. Chuẩn bị định dạng gọi hàm (Function Calling / Tool Calling) để mô hình ra quyết định.

## 3. Tool Calling - Quyết định Tìm Kiếm

Thay vì luôn luôn lao đi tìm kiếm mù quáng, hệ thống áp dụng cơ chế **Semi-Agentic**:
- Hệ thống gửi câu hỏi cho LLM và khai báo một Tool có tên là `search_documents`.
- LLM sẽ phân tích câu hỏi người dùng. 
  - Nếu là chào hỏi xã giao ("xin chào", "cảm ơn"), mô hình sẽ bỏ qua Tool và trả lời trực tiếp ngay.
  - Nếu là câu hỏi cần thông tin, LLM được ép buộc phải gọi hàm `search_documents(query="...")`. Trong đó, LLM thậm chí tự **tối ưu hóa lại câu hỏi (query rewrite)** để kết quả tìm kiếm tốt nhất.

*Lưu ý: Để đảm bảo không bị ảo giác đối với các mô hình nhỏ, nếu phát hiện có lệnh gọi tìm kiếm (hoặc bắt buộc tìm kiếm `force_search`), tiến trình sinh text sẽ bị ngưng lại để nhường chỗ cho Retrieve logic.*

## 4. Xử Lý Truy Xuất Dữ Liệu (Retrieval)

Lệnh tìm kiếm sẽ gọi tới hàm `_execute_search_documents()` và tiếp đó là lớp dịch vụ cấp thấp `CuongRAGService.query_deep()` (Tại `rag-service/app/services/cuong_rag_service.py` & `deep_retriever.py`).

Logic truy xuất lai (Hybrid Retrieval) gồm các bước chạy song song:
1. **Vector Search**: Mã hóa (Embedding) câu hỏi ra dạng Vector. Truy vấn pgvector trong CSDL PostgreSQL bằng phép tính khoảng cách (Cosine/L2) để lọc ra Top-K đoạn văn bản (chunks) gần nghĩa nhất.
2. **Knowledge Graph Search**: Tìm kiếm thực thể trong Knowledge Graph (KG) liên quan đến câu hỏi, kết nối các Node để kéo ra đoạn đồ thị văn cảnh tương ứng (Local + Global Graph Context).
3. **Hình Ảnh & Bảng Biểu**: Liên kết những đoạn text tìm được với ID hình ảnh trong CSDL (`document_images`), để trích xuất cả thông tin ảnh gốc đi kèm trang đó.
4. **Reranking**: Hợp nhất kết quả từ Graph và Vector. Sau đó ném qua một mô hình Reranker (Cross-encoder: bge-reranker-v2-m3) để chấm điểm lại sự liên quan. Bỏ đi các kết quả điểm thấp, lấy các kết quả chính xác nhất.

## 5. Sinh Câu Trả Lời (Generation & Stream)

Khi đã thu thập được dữ liệu, hệ thống lắp ráp chúng thành một Prompt tổng hợp gửi lại cho LLM. Dữ liệu nạp vào gồm:
- Toàn bộ đoạn văn bản liên quan tìm được từ Vector & Graph.
- Hình ảnh đính kèm dạng Base64 (Để sử dụng sức mạnh mô hình Vision Model).
- Lệnh nhắc hệ thống: *"Hãy trả lời dựa trên nội dung nguồn sau đây..."*

**Quá Trình Streaming (SSE) Bắt Đầu:**
Sử dụng vòng lặp `async for chunk in provider.astream()`, mã nguồn sẽ lấy từng token một (từng từ hoặc cụm từ LLM sinh ra) và yield (bắn) về Frontend dưới dạng sự kiện SSE:
- Bắn sự kiện `status`: Trạng thái (Đang tìm kiếm, đang phân tích...).
- Bắn sự kiện `sources`: Gửi toàn bộ trích dẫn (Tên file, số trang, chunk_id).
- Bắn sự kiện `images`: Gửi link ảnh tham khảo.
- Bắn sự kiện `thinking` (Nếu bật): Suy luận nội tại của LLM (DeepSeek mode).
- Bắn sự kiện `token`: Từng chữ cái của câu trả lời hiển thị lên màn hình.

## 6. Lưu Trữ và Đóng Luồng

Khi LLM sinh xong dấu chấm kết thúc (`event: complete`), hệ thống tiến hành:
1. Gói gọn toàn bộ câu trả lời, nguồn tài liệu và các ảnh.
2. Lưu bản ghi dữ liệu vào bảng `chat_messages` trên PostgreSQL để phục vụ tra cứu lịch sử lần sau.
3. Đóng kết nối API, luồng kết thúc thành công. Frontend render giao diện hoàn chỉnh.
