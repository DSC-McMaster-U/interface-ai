.PHONY: help format lint test

help:
	@echo "Commands:"
	@echo "  make format  - Format Python & JavaScript"
	@echo "  make lint    - Lint Python & JavaScript"
	@echo "  make test    - Run all tests"

# Format all code
format:
	black backend/ playwright/ vision-ai/ tests/
	isort backend/ playwright/ vision-ai/ tests/
	cd frontend && npm run format

# Lint all code
lint:
	flake8 backend/ playwright/ vision-ai/ tests/
	mypy backend/ playwright/ vision-ai/
	cd frontend && npm run lint

# Run all tests
test:
	pytest tests/ -v
	cd frontend && npm test

# Docker commands
docker-format:
	docker-compose exec backend black /app
	docker-compose exec backend isort /app
	docker-compose exec backend sh -c "cd /app && npm run format" 2>/dev/null || true

docker-lint:
	docker-compose exec backend flake8 /app
	docker-compose exec backend mypy /app
	docker-compose exec backend sh -c "cd /app && npm run lint" 2>/dev/null || true

docker-test:
	docker-compose exec backend pytest /app/tests -v
	docker-compose exec backend sh -c "cd /app && npm test" 2>/dev/null || true
