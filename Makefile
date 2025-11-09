.PHONY: help check format test

help:
	@echo "Commands:"
	@echo "  make check   - Check for lint/format issues (no changes)"
	@echo "  make format  - Auto-fix and format Python code"
	@echo "  make test    - Run Python tests"

# Check for issues (does NOT modify files)
check:
	ruff check backend/ playwright/ vision-ai/ tests/
	ruff format --check backend/ playwright/ vision-ai/ tests/

# Auto-fix and format code
format:
	ruff check backend/ playwright/ vision-ai/ tests/ --fix
	ruff format backend/ playwright/ vision-ai/ tests/

# Run tests
test:
	pytest tests/ -v

# Docker commands
docker-check:
	docker-compose exec backend ruff check /app
	docker-compose exec backend ruff format --check /app

docker-format:
	docker-compose exec backend ruff check /app --fix
	docker-compose exec backend ruff format /app

docker-test:
	docker-compose exec backend pytest /app/tests -v
