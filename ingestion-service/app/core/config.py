from pydantic_settings import BaseSettings
from pydantic import Field
from functools import lru_cache
from pathlib import Path

# Find .env file — check project root first, fallback for Docker
_candidate = Path(__file__).resolve().parent.parent.parent.parent / ".env"
ENV_FILE = str(_candidate) if _candidate.exists() else ".env"


class Settings(BaseSettings):
    # App
    APP_NAME: str = "CuongRAG - Ingestion Service"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"

    # Base directory (service root)
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent

    # Database
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5435/cuong_rag"
    )

    # LLM Provider: "gemini" | "ollama"
    LLM_PROVIDER: str = Field(default="ollama")

    # Google AI
    GOOGLE_AI_API_KEY: str = Field(default="")

    # Ollama (dùng khi LLM_PROVIDER=ollama)
    OLLAMA_HOST: str = Field(default="http://localhost:11434")
    OLLAMA_MODEL: str = Field(default="Qwen3-32B")
    OLLAMA_VISION_MODEL: str = Field(default="Qwen3-VL-8B-Instruct")
    OLLAMA_API_KEY: str = Field(default="")
    OLLAMA_API_TIMEOUT: float = Field(default=60.0)
    OLLAMA_ENABLE_THINKING: bool = Field(default=False)

    # LLM fast model (API)
    LLM_MODEL_FAST: str = Field(default="Qwen3-32B")
    # Thinking level: "minimal" | "low" | "medium" | "high"
    LLM_THINKING_LEVEL: str = Field(default="medium")
    # Max output tokens (includes thinking tokens)
    LLM_MAX_OUTPUT_TOKENS: int = Field(default=8192)

    # KG Embedding (có thể khác LLM provider)
    KG_EMBEDDING_PROVIDER: str = Field(default="ollama")
    KG_EMBEDDING_MODEL: str = Field(default="Vietnamese_Embedding")
    KG_EMBEDDING_DIMENSION: int = Field(default=1024)
    KG_EMBEDDING_DEVICE: str = Field(default="cpu")

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
    CUONGRAG_KG_EMBEDDING_BATCH_NUM: int = 4
    CUONGRAG_KG_EMBEDDING_MAX_ASYNC: int = 1
    CUONGRAG_KG_EMBEDDING_TIMEOUT_SECONDS: int = 180
    CUONGRAG_KG_LLM_TIMEOUT_SECONDS: int = 240
    CUONGRAG_KG_LANGUAGE: str = "Vietnamese"
    CUONGRAG_KG_ENTITY_TYPES: list[str] = [
        "Organization", "Person", "Product", "Location", "Event",
        "Financial_Metric", "Technology", "Date", "Regulation",
    ]
    CUONGRAG_DEFAULT_QUERY_MODE: str = "hybrid"
    CUONGRAG_MAX_IMAGES_PER_DOC: int = 50
    CUONGRAG_ENABLE_FORMULA_ENRICHMENT: bool = True

    # OCR engine: "docling" (local CPU) | "deepseek_ocr" (API/local) | "mineru" (GPU via CLI)
    # + optional ProtonX Vietnamese correction
    CUONGRAG_OCR_ENGINE: str = "mineru"
    CUONGRAG_MINERU_CMD: str = ""  # CLI template, e.g. "mineru --input {input} --output {output}"
    CUONGRAG_MINERU_CMD_TIMEOUT_SECONDS: int = 1800
    CUONGRAG_MINERU_MARKDOWN_PATH: str = ""  # Relative to output dir or absolute
    CUONGRAG_MINERU_PDF_DPI: int = 200
    CUONGRAG_MINERU_PDF_TIMEOUT_SECONDS: int = 180
    CUONGRAG_MINERU_FALLBACK_ENGINE: str = "docling"  # "docling" | "deepseek_ocr" | "none"
    CUONGRAG_DEEPSEEK_OCR_MODEL: str = Field(default="deepseek-ai/DeepSeek-OCR")
    CUONGRAG_DEEPSEEK_OCR_API_MODEL: str = Field(default="DeepSeek-OCR")
    CUONGRAG_DEEPSEEK_OCR_API_KEY: str = Field(default="")
    CUONGRAG_DEEPSEEK_OCR_PROMPT: str = Field(
        default="<image>\n<|grounding|>Convert the document to markdown."
    )
    CUONGRAG_DEEPSEEK_OCR_DPI: int = 160
    CUONGRAG_DEEPSEEK_OCR_BASE_SIZE: int = 1024
    CUONGRAG_DEEPSEEK_OCR_IMAGE_SIZE: int = 640
    CUONGRAG_DEEPSEEK_OCR_CROP_MODE: bool = True
    CUONGRAG_DEEPSEEK_OCR_TEST_COMPRESS: bool = True

    CUONGRAG_ENABLE_PROTONX_CORRECTION: bool = True
    CUONGRAG_PROTONX_MODEL_NAME: str = "protonx-models/protonx-legal-tc"
    CUONGRAG_PROTONX_BATCH_SIZE: int = 8
    CUONGRAG_PROTONX_MAX_NEW_TOKENS: int = 256

    # Processing timeout (minutes)
    CUONGRAG_PROCESSING_TIMEOUT_MINUTES: int = 10

    # Export indexed document payloads
    CUONGRAG_INDEX_OUTPUT_DIR: str = "/app/output"
    CUONGRAG_OUTPUT_LAYOUT: str = "document"  # "document" | "workspace"
    CUONGRAG_EXPORT_INDEX_JSON: bool = True
    CUONGRAG_EXPORT_MARKDOWN: bool = True
    CUONGRAG_EXPORT_EMBEDDINGS: bool = True
    CUONGRAG_EXPORT_KG_GRAPH: bool = True
    CUONGRAG_KG_EXPORT_MAX_NODES: int = 500

    # Docling PDF render tuning
    CUONGRAG_DOCLING_PDF_DPI: int = 150
    CUONGRAG_DOCLING_PDF_TIMEOUT_SECONDS: int = 120

    # Docling pipeline optimization (from OCR-SERVICE best practices)
    CUONGRAG_DOCLING_OCR_ENABLED: bool = True       # Enable OCR for scanned PDFs
    CUONGRAG_DOCLING_TABLE_STRUCTURE: bool = True    # Enable table structure recognition
    CUONGRAG_DOCLING_IMAGES_SCALE: float = 2.0      # Image quality scale factor
    CUONGRAG_DOCLING_NUM_THREADS: int = 4           # Accelerator thread count
    CUONGRAG_DOCLING_USE_RAPIDOCR: bool = True      # Use RapidOCR (faster+more accurate)

    # Pre-ingestion Deduplication
    CUONGRAG_DEDUP_ENABLED: bool = True
    CUONGRAG_DEDUP_MIN_CHUNK_LENGTH: int = 50
    CUONGRAG_DEDUP_NEAR_THRESHOLD: float = 0.85

    # Retrieval Quality
    CUONGRAG_EMBEDDING_MODEL: str = "Vietnamese_Embedding"
    CUONGRAG_EMBEDDING_DEVICE: str = "cpu"
    CUONGRAG_EMBEDDING_API_MODEL: str = "Vietnamese_Embedding"
    CUONGRAG_EMBEDDING_API_KEY: str = ""
    CUONGRAG_EMBEDDING_API_DIMENSIONS: int = 1024
    CUONGRAG_EMBEDDING_API_ENCODING_FORMAT: str = "float"
    CUONGRAG_RERANKER_MODEL: str = "BAAI/bge-reranker-v2-m3"
    CUONGRAG_RERANKER_API_MODEL: str = "bge-reranker-v2-m3"
    CUONGRAG_RERANKER_API_KEY: str = ""
    CUONGRAG_RERANKER_API_URL: str = ""
    CUONGRAG_RERANKER_API_TIMEOUT: float = 10.0
    CUONGRAG_EMBEDDING_API_URL: str = ""
    CUONGRAG_EMBEDDING_API_TIMEOUT: float = 30.0
    CUONGRAG_DEEPSEEK_OCR_API_URL: str = ""
    CUONGRAG_DEEPSEEK_OCR_API_TIMEOUT: float = 180.0
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
