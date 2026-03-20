# CHƯƠNG 2: CƠ SỞ LÝ THUYẾT VÀ CÁC CÔNG NGHỆ ÁP DỤNG

*Lời dẫn chương:* Chương này trình bày các cơ sở lý thuyết nền tảng, cùng quá trình khảo sát, biện luận để lựa chọn ra các kỹ thuật và công nghệ tối ưu cho hệ thống trợ lý ảo chuyên dụng. Với mỗi bài toán, đề tài sẽ phân tích các phương pháp tiếp cận phổ biến hiện nay, từ đó chỉ ra nhược điểm và đi đến quyết định phương pháp phù hợp nhất được áp dụng ở phần cuối của từng mục. Toàn bộ kiến trúc được triển khai trên nền tảng luồng giao diện (Frontend) lấy cảm hứng từ Speedmaint-UI và lõi truy xuất tri thức dữ liệu (Backend) của hệ thống NexusRAG.

## 2.1. Tổng quan về Mô hình Ngôn ngữ Lớn và kiến trúc RAG

### 2.1.1. Mô hình Ngôn ngữ Lớn (LLMs)
Mô hình Ngôn ngữ Lớn (Large Language Models - LLMs) là các mô hình học sâu (Deep Learning) kiến trúc Transformer, được huấn luyện trên khối dữ liệu văn bản vĩ mô. Nhờ kỹ thuật chú ý phân tán (Self-Attention), LLM có khả năng hiểu các sắc thái ngôn ngữ chuyên sâu và diễn dịch những truy vấn phức tạp của con người thành chuỗi giải nghĩa logic.

### 2.1.2. Hạn chế của LLM và động lực hình thành RAG
- **Phương pháp 1: Tinh chỉnh liên tục toàn bộ mô hình (Fine-Tuning):** Liên tục nạp lại dữ liệu kỹ thuật mới để huấn luyện lại mạng nơ-ron. *Nhược điểm:* Tiêu tốn hàng ngàn giờ xử lý GPU và thường xuyên bị lỗi thời khi có sổ tay hướng dẫn sửa chữa mới ra mắt.
- **Phương pháp 2: Học trong ngữ cảnh tĩnh (Few-shot Prompting):** Nhồi nhét một vài ví dụ giải quyết sự cố vào mồi lệnh. *Nhược điểm:* Giới hạn kích thước bộ nhớ (Context Window) của AI không thể nạp vào nội dung hàng nghìn máy móc thiết bị khác nhau.
- **Lựa chọn của hệ thống: Kiến trúc RAG (Retrieval-Augmented Generation).** Đề tài thiết lập một kênh truy xuất động (khảo sát ngoài) kết nối trực tiếp với CSDL thiết bị hệ thống. Giải pháp RAG khắc phục triệt để rủi ro ảo giác (Hallucination) do AI luôn phải đọc kho tài liệu giới hạn nội bộ lấy về trước khi được phép đưa ra câu trả lời, đồng thời đảm bảo yếu tố "kiểm chứng nguồn gốc" bắt buộc của khối kỹ thuật.

### 2.1.3. Kiến trúc căn bản của Hệ thống RAG
Quy trình vấn đáp qua RAG luôn vận hành theo ba luồng chính tả: 
1. **Lập chỉ mục (Indexing):** Dữ liệu dạng thô được số hóa, làm sạch và nén vào Cơ sở dữ liệu Vector.
2. **Tra cứu (Retrieval):** Lệnh tìm kiếm của thợ bảo trì được hóa dạng Vector, tìm ra 3-5 phân đoạn tài liệu/giao thức chứa dữ kiện khớp nhất.
3. **Sinh văn bản (Generation):** LLM đọc 3-5 phân đoạn đó và tổng hợp thành lời giải đáp hoàn chỉnh.

## 2.2. Các kỹ thuật số hóa và tiền xử lý dữ liệu (Data Ingestion)

### 2.2.1. Kỹ thuật bóc tách tài liệu (OCR / Document Parsing)
- **Phương pháp 1: OCR điểm ảnh quang học truyền thống (ví dụ: Tesseract):** Chuyển nhị phân trắng-đen và nhận diện ký tự từng luồng dòng. *Nhược điểm:* Thường xuyên làm vỡ cấu trúc không gian của tài liệu kỹ thuật, phá nát các khối bảng biểu, sơ đồ hoặc công thức toán lý hóa.
- **Phương pháp 2: Công cụ đọc nội dung mã hóa tĩnh PDF (Rule-based PDF Parser):** Quét chữ cái theo layout mã lập trình (ví dụ: PyPDF2/Pdfplumber). *Nhược điểm:* Bất lực hoàn toàn với các tài liệu mang định dạng ảnh scan hoặc các phiếu công tác có lẫn ghi chú viết tay.
- **Lựa chọn của hệ thống: Ứng dụng mô hình AI phân tích siêu cấu trúc tài liệu (Document Layout Analysis).** Đề tài sử dụng bộ thư viện **Docling** được thiết kế nguyên bản trong lõi NexusRAG để phân tích cấu trúc phức tạp. Kỹ thuật này tự động đóng khung, tách biệt xác định các khối Tiêu đề, Đoạn văn, Hình ảnh và đặc biệt tái tạo lại hoàn hảo các Cột/Hàng của bảng biểu dưới dạng ngôn ngữ đánh dấu siêu nhẹ (Markdown), mở đường hoàn hảo cho khâu phân mảnh.

### 2.2.2. Các chiến lược phân mảnh văn bản (Chunking Strategies)
- **Phương pháp 1: Phân mảnh độ dài chặt cụt cố định (Fixed-size / Token-based Chunking):** Cắt tự động văn bản sau khoảng 500 hoặc 1000 ký tự. *Nhược điểm:* Tỷ lệ rất cao bị ngắt dao chặt đúng giữa 1 từ, 1 bảng dữ liệu hoặc cắt ngang ngữ nghĩa luồng bảo trì đang dang dở.
- **Phương pháp 2: Phân mảnh theo ký tự đệ quy lỏng (Recursive Character Chunking):** Trượt cơ bản tìm khoảng trắng (Space) và dấu câu để cắt. Vẫn có thể bị lạc mất nội dung.
- **Lựa chọn của hệ thống: Phân mảnh tuân theo cấu trúc ngữ nghĩa (Semantic Markdown-based Chunking).** Hệ thống RAG áp dụng bộ chia tách thông minh từ `langchain-text-splitters`, nương theo chuẩn đánh dấu các thẻ tiêu đề (Header H1, H2, v.v.). Sự toàn vẹn về mặt ngữ nghĩa, danh sách kiểm tra sự cố được gắn kết chặt chẽ vào một khối duy nhất không dứt gãy.

## 2.3. Các kỹ thuật lưu trữ và truy xuất tri thức (Retrieval Techniques)

### 2.3.1. Kỹ thuật Biểu diễn dữ liệu bằng Vector Embedding
- **Phương pháp 1: Biểu diễn tần suất từ khóa thưa (Sparse Vector / BM25):** Vector đếm số lượng từ chữ xuất hiện. Tốt cho đối chiếu mã vật tư, nhưng mù tịt về ngữ nghĩa tương đương.
- **Phương pháp 2: Cơ sở Vector mã hóa bên thứ 3 (Cloud Vector DB):** Đẩy mọi tài liệu lên Pinecone hay Weaviate Cloud. *Nhược điểm:* Gây rò rỉ và mất tính riêng tư tài liệu nội sinh.
- **Lựa chọn của hệ thống: Biểu diễn vector dày nội bộ (Dense Local Vector DB).** Hệ thống sử dụng bộ chuyển chiều nhúng (Embedding) thông qua hạt nhân `sentence-transformers`, sau đó nạp toàn bộ vào lõi lưu trữ mạng lưới CSDL Vector cực nhẹ **ChromaDB** chạy trực tiếp (on-premise) trong hạ tầng, triệt tiêu mọi rủi ro bảo mật thông tin vận hành mạng công nghiệp.

### 2.3.2. Tổ chức tri thức bằng Đồ thị tri thức (Knowledge Graph)
- **Phương pháp 1: RAG thuần Vector (Standard RAG):** Các khối tài liệu (Chunks) bị thả trôi rời rạc độc lập trong không gian. *Nhược điểm:* Thiếu đi khả năng bắc cầu chéo. Nếu câu hỏi liên quan tới một cụm chuỗi như "(Van A) gây ảnh hưởng tới (Bơm B) vì tắc (Ống C)", Vector phẳng sinh lỗi tìm kiếm mù.
- **Phương pháp 2: Tự định tuyến thiết kế Đồ thị thủ công (Manual Ontology):** Kỹ sư vạch tay tự vẽ map cho từng ngàn linh kiện máy móc. 
- **Lựa chọn của hệ thống: Graph-RAG động tự chiết xuất Thực thể (Graph Retrieval).** Áp dụng kiến trúc khung kỹ thuật tự động hóa đồ thị **LightRAG** (`lightrag-hku`), nơi mô hình LLM chuyên biệt sẽ đóng vai trò đọc lướt khối nội dung để tự động định danh Thực thể (Ví dụ: Trục Rôto mòn) liên kết Cạnh với Thực thể khác (Gây tụt: Áp suất máy thuỷ lực). Qua đó hình thành lưới tri thức (Knowledge Graph) liên hệ quy mô toàn cục (Global Context), kết nối trực quan với CSDL Vector.

### 2.3.3. Chiến lược truy xuất và tái xếp hạng (Retrieval & Reranking)
- **Phương pháp 1: Top-K Vector truyền thống (Đo khoảng cách Cosine):** Lấy liền 3-5 kết quả gần nhất đưa vào prompt LLM. Dễ mắc nhiễu do vector không tuyệt đối 100% hiểu độ vặn xoắn hàm ý.
- **Lựa chọn của hệ thống: Tra cứu hai ngách kết hợp Bộ phận Tái Xếp hạng (Hybrid Retrieval & Cross-Encoder).** Hệ thống triệu gọi song song hàng chục tài liệu tiềm năng từ Đồ thị Graph và Vector Database. Sau đó toàn bộ đi qua một màng sàng lọc chéo (Cross-encoder Reranker). Ở mạng lưới này, AI sẽ chấm điểm "Câu hỏi vs. Đoạn văn" với cấp độ chính xác chữ/chữ và đẩy các văn bản chứa lời giải thực sự lên cực đại ưu tiên ở đầu chuỗi (Context Window).

## 2.4. Kỹ thuật thiết kế kiến trúc hệ thống (Software Architecture)

### 2.4.1. Lựa chọn mô hình kiến trúc phần mềm
- **Phương pháp 1: Kiến trúc Cục nguyên khối (Monolithic):** Nhồi từ Giao diện, Lưu trữ SQL tới xử lý GPU LLM vào một khối mã nguồn. *Nhược điểm:* Mô hình LLM hay OCR nhai phần cứng GPU kéo sập thanh RAM, khiến Website treo toàn cục không ai truy cập hay thao tác được gì.
- **Phương pháp 2: Vi Dịch Vụ hoàn chỉnh (Microservices):** Chuyển hàng trăm logic thành service siêu nhỏ. *Nhược điểm:* Trễ nhịp mạng lưới (Network latency) và lạm chi phí gián tiếp (DevOps).
- **Lựa chọn của hệ thống: Kiến trúc Bán Vi Dịch vụ (Semi-Microservices).** Thiết kế tách dứt khoát luồng "Làm thuê nặng nền ngầm" (Tiền xử lý văn bản OCR và Vectorize) ra khỏi luồng "Điều phối hội thoại AI" (RAG Service). Backend nhẹ cân gọi API đến các Nút GPU ảo cục bộ (Workers), qua đó giữ cho App luôn mượt mà.

### 2.4.2. Cơ chế giao tiếp và xử lý luồng bất đồng bộ (Async Handling)
- **Phương pháp 1: Xây dựng hệ thống Hàng đợi Chuyên nghiệp (Message Queues - RabbitMQ / Kafka):** Dùng phần mềm môi giới đưa thư. Rất cồng kềnh với mức độ đồ án.
- **Phương pháp 2: Lệnh gọi REST phản hồi giam cứng (Blocking HTTP Response):** Máy khách tải file 100 trang lên và chờ màn hình "Loading..." tới tận 5 phút. Browser phát sinh vòng Timeout, đứt kết nối.
- **Lựa chọn của hệ thống: Gọi xử lý đa tiến trình và theo dõi qua Database dùng chung (Shared State Polling).** Backend API hoàn thành công việc gửi tín hiệu bất đồng bộ dựa trên luồng native Coroutines. Tiết kiệm tài nguyên bằng việc trực tiếp ghi tình trạng quá trình xử lý (PENDING, PROCESSING, SUCCESS) lên cơ sở dữ liệu `PostgreSQL`, giúp luồng Frontend thoải mái bắn tín hiệu cập nhập định kỳ mà không tắc nghẽn giao tiếp mạng.

## 2.5. Kỹ thuật tương tác giao diện và giao tiếp Client–Server (Frontend Techniques)

### 2.5.1. Kỹ thuật truyền tải dữ liệu thời gian thực (Real-time Streaming)
- **Phương pháp 1: Tải mảng khối toàn phần truyền thống (Block HTTP Response):** Trình duyệt yêu cầu và đợi Model LLM tính toán tổng dồn ra đủ cả nghìn từ phản hồi mới bắt đầu hiện thị lên trên. Tốc độ "Time to First Token" cực cao, trải nghiệm tồi tệ.
- **Phương pháp 2: Ống dẫn đường truyền hai chiều (WebSocket Duplex):** Cần duy trì kết nối hao tổn cho Server.
- **Lựa chọn của hệ thống: Sự kiện từ Máy Chủ xuống Máy Khách (Server-Sent Events / SSE).** Tuân thủ tiêu chuẩn HTTP, chỉ mở cổng Streaming truyền đứt đoạn 1 chiều về. Mỗi khi AI GenAI sinh ra 1 từ (token), nó theo mạch (Stream) lọt thẳng về màn hình trình duyệt của Frontend, tạo ra luồng gõ chữ theo thời gian thực (Typing-effect) – đặc tính không thể thiếu của các hệ nền hội thoại đỉnh cao bậc nhất hiện nay.

### 2.5.2. Kỹ thuật quản lý trạng thái và không gian làm việc (Workspace Context)
- **Phương pháp 1: Làm mới giao diện vứt toàn bộ (Stateless):** Ngữ cảnh nói chuyện và phiên kết nối tài liệu bay màu khi chuyển trang.
- **Lựa chọn của hệ thống: Global State Management (Phân vùng trạng thái).** Hệ thống áp dụng cô lập luồng hội thoại theo 'Không gian làm việc' (Workspaces). Khối lượng kho tài liệu, lịch sử máy A và lỗi máy B không bị nhập nhằng ngữ nghĩa. Frontend (Speedmaint-ui) nhận chỉ đạo bảo vệ State phân cách cực kỳ quy củ, duy trì "Bộ nhớ phiên" siêu hạng cho Copilot.

## 2.6. Tổng hợp công nghệ và công cụ thực tế sử dụng

Từ quá trình khảo sát, thực tiễn hệ thống đã được đồng bộ xây dựng bằng khối kiến trúc lõi sau:

### 2.6.1. Nhóm công nghệ Giao diện người dùng (Hệ sinh thái Speedmaint-UI)
- **Framework nền tảng:** Giao diện được xây dựng cực kỳ tối giản mà đầy đủ chức năng quản trị bằng thư viện **React.js**, đóng gói biên dịch và theo dõi thời gian thực nhờ công cụ Builder **Vite**.
- **Module Thiết kế:** Tối ưu hóa UI nhanh chóng bằng nền tảng Utility-First **TailwindCSS** kết hợp các gói biểu đồ `recharts` / `@tremor/react` cho các Component khối đồ hình kỹ thuật mượt mà.

### 2.6.2. Nhóm công nghệ Máy chủ và Cơ sở dữ liệu (Lõi NexusRAG)
- **Core API Backend:** Lập trình phần mềm điều phối lõi bằng ngôn ngữ **Python**, sử dụng siêu nền tảng API tĩnh **FastAPI** đẩy chạy luồng dưới ASGI Uvicorn để bắt xử lý đa luồng (Async) xuất sắc.
- **Kho lưu trữ Cấu trúc (Database):** CSDL chính sử dụng **PostgreSQL** kết nối hoàn toàn bất đồng bộ thông qua `asyncpg`. Module thao tác ORM áp dụng `SQLAlchemy`, quản lý thay thế di chuyển hạ tầng qua bộ Migration `Alembic`.

### 2.6.3. Nhóm Lõi Trí tuệ Nhân tạo & Vector Store (NexusRAG AI Core)
- **Xử lý tài liệu:** Sử dụng bộ dở hóa siêu sạch bảng biểu đa phương tầng **Docling**.
- **Cơ sở Lưu trữ Đồ thị / Vector:** Mạch Nhúng Vector kết nối `sentence-transformers` nạp vào **ChromaDB**. Kiến trúc mạng đồ thị quản trị rễ bằng thuật toán tối ưu **LightRAG** (`lightrag-hku`).
- **Trung tâm Ngôn ngữ AI (LLMs Engine):** Áp dụng môi trường lai Hybrid giữa mô hình Cloud siêu việt (`google-genai`) và bộ đóng gói cực kỳ an toàn bảo mật, giúp máy nội bộ nhà máy (Local Air-gapped) chạy nhẹ LLM riêng lẻ qua **Ollama**. Mọi text được chuẩn hóa phân mảnh siêu cấp từ module chuyên dụng lõi `langchain-text-splitters`.
