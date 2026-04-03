FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# System deps:
# - Base build/runtime: curl, build-essential, poppler, libmagic
# - OpenCV runtime (fix libGL.so.1): libgl1 + X11 libs
# - DeepSeek OCR PDF rendering: poppler-utils (pdftoppm)
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl \
        build-essential \
        poppler-utils \
        libmagic1 \
        libglib2.0-0 \
        libgl1 \
        libsm6 \
        libxext6 \
    libxrender1 \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps first (layer cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy service source
COPY app ./app

EXPOSE 8082

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8082", "--workers", "1"]
