# CuongRAG — Intelligent Document Retrieval & Features

Dự án CuongRAG là một hệ thống RAG (Retrieval-Augmented Generation) vi dịch vụ hoàn chỉnh, bao gồm backend xử lý tài liệu, vector search, knowledge graph và một giao diện frontend hiện đại.

## Kiến trúc hệ thống hiện tại
Hệ thống được tối ưu hóa để chạy local development thông qua Docker Compose, bao gồm các service kết nối trực tiếp với nhau:

1. **Frontend** (Vite + React, Port `3001` trong docker hoặc `3000` chạy trực tiếp)
2. **rag-service** (FastAPI, Port `8081`): Service RAG, Chat, Workspaces, Documents
3. **ingestion-service** (FastAPI, Port `8082`): Xử lý tài liệu, chunking
4. **kg-service** (FastAPI, Port `8083`): Trích xuất Knowledge Graph
5. **postgres** (pgvector, Port `5435`): Lưu trữ vector embeddings và database metadata

---

## 🚀 Hướng dẫn khởi chạy dự án (Docker Compose)

Đây là cách đơn giản và đồng bộ nhất để chạy toàn bộ dự án.

### Bước 1: Khởi tạo biến môi trường
Mở terminal tại thư mục gốc của dự án (`/home/cuongnh/cuong/cuong_rag`), copy file `.env.example` thành `.env` (nếu chưa có):

```bash
cp .env.example .env
```
*(Đảm bảo trong `.env` đã có cấu hình API Key của Google Gemini hoặc các LLM khác theo yêu cầu).*

### Bước 2: Build và chạy toàn bộ bằng Docker
Docker sẽ phụ trách build các container Python và tải các dependencies của Node.js:

```bash
docker compose up -d --build
```

### Bước 3: Kiểm tra các service đang chạy
Bạn có thể dùng lệnh sau để xem các container đã khởi động thành công (trạng thái cần là `Up (healthy)`)

```bash
docker compose ps
```

### Bước 4: Trải nghiệm ứng dụng
Khi frontend container khởi động xong, hãy mở trình duyệt và truy cập:
👉 **[http://localhost:3001](http://localhost:3001)**

---

## 🛠 Cách chạy Frontend độc lập (Developer Mode)

Nếu bạn muốn chỉnh sửa, phát triển Frontend (React) và muốn hot-reload trực tiếp mà không cần build lại qua Docker:

1. Chạy Backend bằng Docker:
   ```bash
   docker compose up -d postgres rag-service ingestion-service kg-service
   ```
2. Cài đặt và cấu hình bypass permission cho máy local:
   ```bash
   mkdir -p /home/cuongnh/cuong/cuong_rag/frontend/.vite-cache
   ```
3. Chạy lệnh dev:
   ```bash
   cd frontend
   yarn install
   yarn dev --host
   ```
4. Truy cập **[http://localhost:3000](http://localhost:3000)**

---

## Các vấn đề thường gặp (Troubleshooting)

**1. Lỗi permission khi chạy `yarn dev`:**
Nếu bạn gặp lỗi `EACCES: permission denied, mkdir '/home/cuongnh/.../node_modules/.vite/'`, đó là do thư mục `node_modules` trước đó đã được tải xuống bởi user `root` trong container Docker.
**Khắc phục**: Chạy `sudo chown -R $USER:$USER /home/cuongnh/cuong/cuong_rag/frontend/node_modules` hoặc xóa toàn bộ file đó đi cài lại (`sudo rm -rf node_modules`). Trong version cấu hình mới nhất, `vite.config.js` đã được thiết lập `cacheDir: "./.vite-cache"` để tránh đụng chạm vào thư mục node_modules.

**2. Chat / Upload tài liệu không phản hồi:**
Kiểm tra log của `rag-service` để biết chi tiết:
```bash
docker compose logs -f rag-service
```
Đảm bảo bạn đã cấp đúng Token LLM (Gemini API) trong file `.env`.

**3. Reset toàn bộ Data (Xóa VectorDB và Uploads):**
Nếu muốn làm lại từ đầu (xóa sạch dữ liệu postgres và document files):
```bash
docker compose down -v
```
*(Lưu ý: Lệnh này sẽ xóa toàn bộ workspace, documents trong cơ sở dữ liệu).*
