# Simplified CI/CD Setup ✅

Clean and simple setup with Ruff for Python linting, formatting, and testing.

## What You Have

### ✅ Linter & Formatter
- **Python:** Ruff (replaces black, isort, flake8, mypy)

### ✅ Tests
- **Python:** pytest (4 tests, 100% backend coverage)

## Quick Commands

### Windows
```cmd
.\dev check   # Check for issues (no changes)
.\dev format  # Auto-fix issues
.\dev test    # Run tests
```

### Linux/Mac
```bash
make check   # Check for issues (no changes)
make format  # Auto-fix issues
make test    # Run tests
```

### Docker
```bash
make docker-check   # Check in Docker
make docker-format  # Format in Docker
make docker-test    # Test in Docker
```

## GitHub Actions

**Auto-runs on push to `main` or `develop`:**
1. ✅ Check with Ruff (identifies errors, does NOT fix)
2. ✅ Run Python tests
3. ❌ Fails if issues found (you fix locally)

See: `.github/workflows/ci.yml`

## Files

### Config Files
- `pyproject.toml` - Ruff & pytest config

### Dev Dependencies
- `dev-requirements.txt` - Python dev tools (ruff, pytest)

### Commands
- `dev.bat` - Windows commands
- `Makefile` - Linux/Mac commands

### Documentation
- `DEVOPS.md` - Full DevOps guide
- `SETUP_SUMMARY.md` - This file

## Installation

```bash
# Python dev tools only
pip install -r dev-requirements.txt
```

## That's It! 🎉

Simple Ruff-based workflow:
- **CI checks** (doesn't fix)
- **Local fixes** (you run `dev format`)
- Works in venv or Docker
