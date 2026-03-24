# Công nghệ sử dụng

Danh sách công nghệ đang xuất hiện trong mã nguồn hiện tại.

## 1) Backend

### Runtime
- Python 3.11 (Docker image `python:3.11-slim`)
- FastAPI
- Uvicorn

### Database
- PostgreSQL 15 + pgvector (`pgvector/pgvector:pg15`)
- SQLAlchemy (async)
- asyncpg
- Alembic

### AI / NLP / RAG
- sentence-transformers
- langchain-text-splitters
- lightrag-hku
- ollama (client)
- google-genai

### OCR / Parsing
- MinerU
- Docling
- doclayout-yolo
- ultralytics
- tesseract-ocr (system package)

### Utilities
- pydantic v2 + pydantic-settings
- python-dotenv
- httpx
- aiofiles
- Pillow

## 2) Frontend

### Core
- React 18
- React Router DOM
- Vite 4
- ESLint + Prettier

### UI/UX & Components
- react-toastify
- recharts
- react-dropzone
- react-tooltip
- highlight.js
- markdown-it
- katex

### Build/Styling
- TailwindCSS
- PostCSS
- Autoprefixer

## 3) Hạ tầng & DevOps

- Docker
- Docker Compose
- Nginx (trong image frontend production)
- Makefile cho lệnh vận hành nhanh

## 4) Cấu hình mô hình (env)

### LLM Provider
- `LLM_PROVIDER=ollama` (local-first)
- hoặc `LLM_PROVIDER=gemini`

### Embedding/KG
- `KG_EMBEDDING_PROVIDER=sentence_transformers` (default)
- model mặc định: `BAAI/bge-m3`

### CuongRAG pipeline flags
- `CUONGRAG_ENABLE_KG`
- `CUONGRAG_ENABLE_IMAGE_EXTRACTION`
- `CUONGRAG_ENABLE_IMAGE_CAPTIONING`
- `CUONGRAG_ENABLE_TABLE_CAPTIONING`
- các tham số chunk/rerank/timeout khác.

## 5) Cổng dịch vụ

- Frontend: `3001`
- RAG API: `8081`
- Ingestion API: `8082`
- KG API: `8083`
- Postgres host port: `5435`
