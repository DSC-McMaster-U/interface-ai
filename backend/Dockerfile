FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Install dev dependencies for linting/formatting/testing
COPY ../dev-requirements.txt ./dev-requirements.txt
RUN pip install --no-cache-dir -r dev-requirements.txt

COPY . .

EXPOSE 5000
CMD ["python", "app/main.py"]
