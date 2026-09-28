# Multi-stage Dockerfile for TerraWatt FastAPI Backend
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose FastAPI port
EXPOSE 8000

# Start command
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
