# Đặc tả Use Case (Ca sử dụng) Hệ thống CuongRAG

Dưới đây là đặc tả chi tiết cho 6 Use Case cốt lõi nhất của hệ thống, được định dạng theo chuẩn bảng để dễ dàng chèn vào báo cáo phân tích thiết kế.

---

### 1. UC01: Quản lý không gian làm việc (Workspace)

| Thuộc tính | Mô tả |
| :--- | :--- |
| **Mã UC** | UC01 |
| **Tên** | **Tạo và Quản lý Không gian làm việc (Workspace)** |
| **Tác nhân** | Người dùng |
| **Mô tả** | Người dùng tạo một không gian làm việc mới để phân lập và lưu trữ tài liệu theo từng dự án cụ thể, đồng thời thiết lập System Prompt (lời nhắc hệ thống) tùy chỉnh. |
| **Tiền điều kiện**| Hệ thống hoạt động bình thường, kết nối cơ sở dữ liệu ổn định. |
| **Luồng chính** | 1. Người dùng chọn chức năng "Tạo mới Workspace" trên giao diện.<br>2. Hệ thống hiển thị form nhập thông tin (Tên Workspace, Mô tả, System Prompt).<br>3. Người dùng điền thông tin và nhấn "Lưu".<br>4. Hệ thống kiểm tra tính hợp lệ của dữ liệu, tạo bản ghi vào bảng `workspaces`.<br>5. Hệ thống thông báo thành công và chuyển hướng người dùng vào giao diện chi tiết của Workspace vừa tạo. |
| **Luồng ngoại lệ**| 4a. Dữ liệu nhập bị thiếu Tên → Hệ thống báo lỗi "Tên không được để trống", yêu cầu nhập lại.<br>4b. Lỗi kết nối CSDL → Hệ thống báo lỗi "Tạo không thành công do lỗi máy chủ". |
| **Hậu điều kiện** | Một Workspace mới được tạo và hiển thị trong danh sách của người dùng, sẵn sàng để nhận tài liệu. |

---

### 2. UC02: Tải lên tài liệu

| Thuộc tính | Mô tả |
| :--- | :--- |
| **Mã UC** | UC02 |
| **Tên** | **Tải lên tài liệu (Upload Document)** |
| **Tác nhân** | Người dùng |
| **Mô tả** | Người dùng chọn file tài liệu kỹ thuật/báo cáo (PDF, DOCX) tải lên Workspace để hệ thống đưa vào hàng đợi xử lý. |
| **Tiền điều kiện**| Người dùng đang truy cập vào một Workspace cụ thể. |
| **Luồng chính** | 1. Người dùng kéo thả file hoặc nhấn "Chọn tệp" vào khu vực tải lên.<br>2. Người dùng nhấn nút "Tải lên" (Upload).<br>3. Hệ thống kiểm tra định dạng và dung lượng file.<br>4. Hệ thống lưu file vào kho cục bộ (`.data/uploads`) và tạo bản ghi trong cơ sở dữ liệu với trạng thái là `PENDING`.<br>5. Giao diện cập nhật danh sách tài liệu kèm thẻ trạng thái "Chờ xử lý". |
| **Luồng ngoại lệ**| 3a. Định dạng file không hỗ trợ → Hệ thống báo lỗi từ chối tải lên.<br>3b. File vượt quá dung lượng cho phép → Hệ thống báo lỗi vượt ngưỡng dung lượng. |
| **Hậu điều kiện** | File được lưu trữ vật lý thành công, thông tin file nằm trong CSDL chờ được bóc tách. |

---

### 3. UC03: Xử lý và Lập chỉ mục tài liệu (Data Ingestion)

| Thuộc tính | Mô tả |
| :--- | :--- |
| **Mã UC** | UC03 |
| **Tên** | **Xử lý và Lập chỉ mục tài liệu (Process/Index)** |
| **Tác nhân** | Người dùng |
| **Mô tả** | Chuyển đổi file tài liệu thô thành văn bản, tạo vector ngữ nghĩa và trích xuất thực thể đồ thị (Knowledge Graph) để đưa vào cơ sở dữ liệu. |
| **Tiền điều kiện**| Tài liệu đã được tải lên thành công (trạng thái `PENDING`). |
| **Luồng chính** | 1. Người dùng nhấn nút "Xử lý" đối với tài liệu mong muốn.<br>2. Hệ thống chuyển trạng thái sang `PARSING`, kích hoạt quá trình OCR (Docling/MinerU) để bóc tách text, bảng biểu, và dùng Qwen2-VL mô tả hình ảnh.<br>3. Sau khi bóc tách, hệ thống chuyển sang trạng thái `INDEXING`, tiến hành cắt đoạn (Chunking) văn bản Markdown.<br>4. Hệ thống thực hiện gọi Cloud API nhúng vector (Embedding) và trích xuất thực thể Đồ thị tri thức.<br>5. Lưu dữ liệu vào bảng vector và graph trong PostgreSQL.<br>6. Hệ thống chuyển trạng thái thành `INDEXED`. |
| **Luồng ngoại lệ**| 2a. OCR thất bại do file hỏng → Chuyển trạng thái sang `FAILED`, lưu error_message, thông báo lỗi cho người dùng.<br>4a. Quá tải Cloud API → Hệ thống ngắt tiến trình, báo trạng thái `FAILED`. |
| **Hậu điều kiện** | Dữ liệu của tài liệu đã nằm trong DB (dạng Vector và Graph), sẵn sàng phục vụ các câu hỏi của người dùng. |

---

### 4. UC04: Truy vấn và Trò chuyện với Trợ lý ảo

| Thuộc tính | Mô tả |
| :--- | :--- |
| **Mã UC** | UC04 |
| **Tên** | **Trò chuyện và Truy vấn tài liệu (Chat/Query)** |
| **Tác nhân** | Người dùng |
| **Mô tả** | Người dùng đặt câu hỏi dựa trên tài liệu có trong hệ thống và nhận câu trả lời thời gian thực (streaming) kèm trích dẫn nguồn. |
| **Tiền điều kiện**| Workspace có ít nhất một tài liệu đã xử lý xong (`INDEXED`). |
| **Luồng chính** | 1. Người dùng nhập câu hỏi vào ô chat và nhấn "Gửi".<br>2. Hệ thống nhúng câu hỏi thành vector.<br>3. Hệ thống tìm kiếm song song: Vector Search và Graph Search, sau đó dùng Reranker lọc ra ngữ cảnh tốt nhất.<br>4. Lắp ráp ngữ cảnh với Prompt và gọi LLM (Qwen).<br>5. LLM trả kết quả về giao diện dưới dạng luồng (Server-Sent Events).<br>6. Hệ thống gắn kèm nguồn trích dẫn dạng `[1]`, `[2]`.<br>7. Lưu lịch sử câu hỏi và câu trả lời vào CSDL. |
| **Luồng ngoại lệ**| 3a. Không tìm thấy thông tin trong tài liệu → Hệ thống tự động sinh ra phản hồi từ chối (Anti-hallucination): "Tôi không tìm thấy thông tin...".<br>4a. Lỗi kết nối LLM API → Hiển thị thông báo "Máy chủ AI đang bận". |
| **Hậu điều kiện** | Người dùng nhận được đáp án minh bạch (có thể click vào `[1]` để xem văn bản gốc), lịch sử hội thoại được lưu vết lại. |

---

### 5. UC05: Xóa tài liệu

| Thuộc tính | Mô tả |
| :--- | :--- |
| **Mã UC** | UC05 |
| **Tên** | **Xóa tài liệu (Delete Document)** |
| **Tác nhân** | Người dùng |
| **Mô tả** | Xóa tài liệu khỏi hệ thống bao gồm file gốc, toàn bộ chunks vector và hình ảnh/bảng biểu liên quan để dọn dẹp dung lượng. |
| **Tiền điều kiện**| Tài liệu tồn tại trong Workspace. |
| **Luồng chính** | 1. Người dùng chọn biểu tượng "Xóa" cạnh tên tài liệu.<br>2. Hệ thống hiển thị hộp thoại xác nhận "Bạn có chắc chắn muốn xóa?".<br>3. Người dùng nhấn "Đồng ý".<br>4. Hệ thống thực hiện xóa bản ghi trong bảng `documents`, do cơ chế ràng buộc khóa ngoại (CASCADE), toàn bộ `vector_chunks`, `images`, `tables` liên quan bị xóa theo.<br>5. Hệ thống xóa file vật lý trên ổ cứng.<br>6. Giao diện tải lại danh sách tài liệu. |
| **Luồng ngoại lệ**| 5a. File vật lý đang bị khóa bởi process khác (lỗi OS) → Chỉ xóa dữ liệu trong DB, giữ nguyên file vật lý và ghi log hệ thống để dọn dẹp sau. |
| **Hậu điều kiện** | Tài liệu bị gỡ bỏ hoàn toàn khỏi không gian làm việc và không còn xuất hiện làm ngữ cảnh trong các lượt chat tiếp theo. |

---

### 6. UC06: Trực quan hóa Đồ thị tri thức (Knowledge Graph)

| Thuộc tính | Mô tả |
| :--- | :--- |
| **Mã UC** | UC06 |
| **Tên** | **Trực quan hóa Đồ thị tri thức** |
| **Tác nhân** | Người dùng |
| **Mô tả** | Người dùng xem sơ đồ dạng mạng lưới (Nodes & Edges) để thấy trực quan các mối liên hệ giữa các thực thể, khái niệm chuyên ngành có trong tài liệu. |
| **Tiền điều kiện**| Tài liệu đã được trích xuất Knowledge Graph thành công. |
| **Luồng chính** | 1. Người dùng chuyển sang màn hình "Đồ thị tri thức" trong Workspace.<br>2. Giao diện gọi API lấy dữ liệu nodes và edges.<br>3. Hệ thống trả về cấu trúc Graph JSON.<br>4. Giao diện render đồ thị mạng lưới.<br>5. Người dùng tương tác (phóng to, thu nhỏ, click vào một thực thể cụ thể để xem chi tiết và các mối quan hệ lân cận). |
| **Luồng ngoại lệ**| 2a. Workspace chưa có thực thể nào → Giao diện hiển thị "Chưa có dữ liệu đồ thị".<br>4a. Đồ thị quá lớn gây lag trình duyệt → Hệ thống tự động giới hạn chỉ hiển thị 500 node phổ biến nhất (Top degree nodes). |
| **Hậu điều kiện** | Người dùng nắm được cái nhìn tổng thể về mạng lưới thông tin phức tạp nằm rải rác trong nhiều file báo cáo khác nhau. |
