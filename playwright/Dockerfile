FROM mcr.microsoft.com/playwright/python:v1.47.0-jammy

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN playwright install chromium
COPY action_executor.py .
COPY app.py .
COPY worker.py .
EXPOSE 7000
# Run HTTP API so backend can call /navigate, /click, etc. (for worker-only: python worker.py)
CMD ["python", "app.py"]
