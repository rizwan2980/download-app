# Multi-stage / Production-grade Debian-slim Python image
FROM python:3.11-slim-bookworm

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HOST=0.0.0.0 \
    PORT=8000 \
    DOWNLOADS_DIR=/app/downloads \
    DOCKER_CONTAINER=1

# Install system dependencies including FFmpeg, Node.js (for JS challenge solving), curl, and ca-certificates
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    nodejs \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install Python dependencies first for caching
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY backend/ ./backend/
COPY static/ ./static/
COPY main.py .

# Create downloads storage directory
RUN mkdir -p /app/downloads && chmod 777 /app/downloads

# Expose default port (Render/Railway map dynamic PORT, Hugging Face uses 7860)
EXPOSE 8000 7860

# Healthcheck definition for container runtimes
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/health || exit 1

# Start the FastAPI production server
CMD ["python", "main.py"]
