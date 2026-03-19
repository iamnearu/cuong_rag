from pydantic_settings import BaseSettings
from pydantic import Field
from functools import lru_cache
from pathlib import Path

# Find .env file — check project root first, fallback for Docker
_candidate = Path(__file__).resolve().parent.parent.parent.parent / ".env"
ENV_FILE = str(_candidate) if _candidate.exists() else ".env"


class Settings(BaseSettings):
    # App
    APP_NAME: str = "CuongRAG - KG Service"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"

    # Base directory (service root)
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent

    # Database
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5435/cuong_rag"
    )

    # LLM Provider: "gemini" | "ollama"
    LLM_PROVIDER: str = Field(default="gemini")

    # Google AI
    GOOGLE_AI_API_KEY: str = Field(default="")

    # Ollama (dùng khi LLM_PROVIDER=ollama)
    OLLAMA_HOST: str = Field(default="http://localhost:11434")
    OLLAMA_MODEL: str = Field(default="gemma3:12b")
    OLLAMA_ENABLE_THINKING: bool = Field(default=False)

    # LLM fast model (Gemini)
    LLM_MODEL_FAST: str = Field(default="gemini-2.5-flash")
    # Thinking level: "minimal" | "low" | "medium" | "high"
    LLM_THINKING_LEVEL: str = Field(default="medium")
    # Max output tokens (includes thinking tokens)
    LLM_MAX_OUTPUT_TOKENS: int = Field(default=8192)

    # KG Embedding (có thể khác LLM provider)
    KG_EMBEDDING_PROVIDER: str = Field(default="gemini")
    KG_EMBEDDING_MODEL: str = Field(default="gemini-embedding-001")
    KG_EMBEDDING_DIMENSION: int = Field(default=3072)

    # ---- CuongRAG Pipeline ---------------------------------------------------
    CUONGRAG_ENABLED: bool = True
    CUONGRAG_ENABLE_KG: bool = True
    CUONGRAG_ENABLE_IMAGE_EXTRACTION: bool = True
    CUONGRAG_ENABLE_IMAGE_CAPTIONING: bool = True
    CUONGRAG_ENABLE_TABLE_CAPTIONING: bool = True
    CUONGRAG_MAX_TABLE_MARKDOWN_CHARS: int = 8000
    CUONGRAG_CHUNK_MAX_TOKENS: int = 512
    CUONGRAG_KG_QUERY_TIMEOUT: float = 30.0
    CUONGRAG_KG_CHUNK_TOKEN_SIZE: int = 1200
    CUONGRAG_KG_LANGUAGE: str = "English"
    CUONGRAG_KG_ENTITY_TYPES: list[str] = [
        "Organization", "Person", "Product", "Location", "Event",
        "Financial_Metric", "Technology", "Date", "Regulation",
    ]
    CUONGRAG_DEFAULT_QUERY_MODE: str = "hybrid"
    CUONGRAG_DOCLING_IMAGES_SCALE: float = 2.0
    CUONGRAG_MAX_IMAGES_PER_DOC: int = 50
    CUONGRAG_ENABLE_FORMULA_ENRICHMENT: bool = True

    # Processing timeout (minutes)
    CUONGRAG_PROCESSING_TIMEOUT_MINUTES: int = 10

    # Pre-ingestion Deduplication
    CUONGRAG_DEDUP_ENABLED: bool = True
    CUONGRAG_DEDUP_MIN_CHUNK_LENGTH: int = 50
    CUONGRAG_DEDUP_NEAR_THRESHOLD: float = 0.85

    # Retrieval Quality
    CUONGRAG_EMBEDDING_MODEL: str = "BAAI/bge-m3"
    CUONGRAG_EMBEDDING_DEVICE: str = "cpu"
    CUONGRAG_RERANKER_MODEL: str = "BAAI/bge-reranker-v2-m3"
    CUONGRAG_RERANKER_DEVICE: str = "cpu"
    CUONGRAG_VECTOR_PREFETCH: int = 20
    CUONGRAG_RERANKER_TOP_K: int = 8
    CUONGRAG_MIN_RELEVANCE_SCORE: float = 0.15
    # -------------------------------------------------------------------------

    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:3001",
        "http://localhost:80",
        "http://localhost",
    ]

    model_config = {
        "env_file": str(ENV_FILE),
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
