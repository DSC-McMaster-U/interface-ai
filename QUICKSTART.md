# Quick Start - Ruff Setup

## ✅ Changes Made

Simplified to use **Ruff only** for Python:
- ❌ Removed: black, isort, flake8, mypy
- ❌ Removed: All JavaScript linting/formatting (ESLint, Prettier, Jest)
- ✅ Added: Ruff (one tool replaces all of the above)

## 🚀 Setup

### Option 1: Use Virtual Environment (Recommended)

```powershell
# Create venv
python -m venv .venv

# Activate
.\.venv\Scripts\Activate.ps1

# Install deps
pip install -r dev-requirements.txt

# Now commands will work
.\dev check
.\dev format
.\dev test
```

### Option 2: Fix Global Install

If you get permission errors installing globally, run PowerShell as Administrator:
```powershell
pip install ruff pytest pytest-cov
```

## 📝 Commands

```powershell
.\dev check   # Check for issues (CI does this)
.\dev format  # Fix issues locally
.\dev test    # Run tests
```

## 🐳 Docker Commands

```bash
make docker-check   # Check in Docker
make docker-format  # Format in Docker
make docker-test    # Test in Docker
```

## 🤖 GitHub Actions

CI runs `ruff check` and `ruff format --check`:
- ✅ Identifies errors
- ❌ Does NOT auto-fix
- ❌ Fails if issues found
- 👤 You fix locally with `.\dev format`

## 📦 What's Installed

- **ruff** - Fast Python linter & formatter
- **pytest** - Python testing framework

That's it! Simple and fast. 🚀
