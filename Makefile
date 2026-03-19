# CuongRAG — Developer Makefile
.PHONY: up down build restart logs ps clean

## Start tất cả services
up:
	docker compose up -d

## Stop tất cả services
down:
	docker compose down

## Build lại tất cả images
build:
	docker compose build

## Restart một service cụ thể: make restart svc=rag-service
restart:
	docker compose restart $(svc)

## Xem logs — tất cả: make logs | một service: make logs svc=rag-service
logs:
	@if [ -z "$(svc)" ]; then \
		docker compose logs -f; \
	else \
		docker compose logs -f $(svc); \
	fi

## Xem trạng thái containers
ps:
	docker compose ps

## Health check nhanh
health:
	@echo "--- RAG Service ---" && curl -s http://localhost:8081/health | python3 -m json.tool
	@echo "--- Ingestion Service ---" && curl -s http://localhost:8082/health | python3 -m json.tool
	@echo "--- KG Service ---" && curl -s http://localhost:8083/health | python3 -m json.tool

## Xóa toàn bộ data (volumes)
clean:
	docker compose down -v
	@echo "Đã xóa tất cả volumes (PostgreSQL/pgvector + uploads)"

## Setup lần đầu
setup:
	@if [ ! -f .env ]; then cp .env.example .env && echo "Created .env — hãy điền GOOGLE_AI_API_KEY"; fi
	docker compose build
	docker compose up -d
