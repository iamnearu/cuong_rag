
# CuongRAG — RAG Microservices Platform

Hệ thống RAG theo kiến trúc microservices gồm frontend, RAG API, ingestion API, KG API và PostgreSQL/pgvector.

## Quickstart

```bash
cd cuong_rag
cp .env.example .env
docker compose up -d
```

Mở UI: <http://localhost:3001>

Kiểm tra health:

```bash
curl http://localhost:8081/health
curl http://localhost:8082/health
curl http://localhost:8083/health
```

## Tài liệu chi tiết

Tài liệu đã được tách nhỏ theo chủ đề trong thư mục `docs/`:

- [docs/README.md](./docs/README.md)
- [docs/infrastructure.md](./docs/infrastructure.md)
- [docs/guide.md](./docs/guide.md)
- [docs/logic.md](./docs/logic.md)
- [docs/technologies.md](./docs/technologies.md)
- [docs/api-reference.md](./docs/api-reference.md)
- [docs/project-structure.md](./docs/project-structure.md)
- [docs/guild.md](./docs/guild.md)

## Services & Ports

| Service | Port | Vai trò |
|---|---:|---|
| `frontend` | 3001 | React UI |
| `rag-service` | 8081 | Workspace, documents, chat/query, analytics |
| `ingestion-service` | 8082 | Upload và xử lý tài liệu |
| `kg-service` | 8083 | Knowledge graph endpoints |
| `postgres` | 5435 | Metadata DB + Vector store |

## Ghi chú vận hành nhanh

- Up lại frontend: `docker compose up -d frontend`
- Build + up frontend: `docker compose up -d --build frontend`
- Xem log: `docker compose logs -f rag-service`
- Reset dữ liệu: `docker compose down -v`
