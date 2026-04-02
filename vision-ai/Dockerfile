FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .

# Install system dependencies required by OpenCV and EasyOCR
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir -r requirements.txt

# Copy all python components
COPY service.py .
COPY pipeline.py .
COPY common_utils.py .

EXPOSE 6000
CMD ["python", "service.py"]
