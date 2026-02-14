import os
import time
import requests

BACKEND = os.getenv("BACKEND_URL", "http://backend:5000")

if __name__ == "__main__":
    print("Playwright worker starting...")
    for _ in range(3):
        try:
            r = requests.get(f"{BACKEND}/health", timeout=5)
            print("Backend health:", r.text)
            break
        except Exception as e:
            print("Waiting for backend...", e)
            time.sleep(2)
    print("Worker ready.")
