# CI/CD Documentation

This document explains how to set up and run tests, formatters, and linters for the InterfaceAI project. All checks run automatically on GitHub Actions before code can be merged into `main`.

---

## Quick Start

**Before pushing code or creating a PR, always run:**

```bash
# 1. Format and lint code
./run-lint-formatter.sh

# 2. Run all tests
./run-tests.sh
```

---

## Local Setup and Execution

### Complete Setup

1. **Clone the repository**:

   ```bash
   git clone <repository-url>
   cd interface-ai
   ```

2. **Set up Python environment**:

   ```bash
   # For each Python service (backend, playwright, vision-ai)
   cd backend
   pip install -r requirements.txt
   cd ../playwright
   pip install -r requirements.txt
   cd ../vision-ai
   pip install -r requirements.txt
   cd ..
   ```

3. **Set up Node.js environment**:

   ```bash
   cd frontend
   npm install
   cd ..
   ```

4. **Make scripts executable** (Linux/Mac):
   ```bash
   chmod +x run-tests.sh
   chmod +x run-lint-formatter.sh
   ```

### Running All Checks Locally

Before pushing code or creating a PR, run all checks:

```bash
# 1. Format and lint code
./run-lint-formatter.sh

# 2. Run all tests
./run-tests.sh
```

### Pre-Commit Workflow

Recommended workflow before committing:

1. **Format code**:

   ```bash
   ./run-lint-formatter.sh
   ```

2. **Run tests**:

   ```bash
   ./run-tests.sh
   ```

3. **Commit and push**:
   ```bash
   git add .
   git commit -m "Your commit message"
   git push
   ```

---

## Test Cases

### Overview

- **Python Services** (backend, playwright, vision-ai): Uses `pytest`
- **Frontend** (Chrome Extension): Uses `Jest`

### Test Locations

- `backend/tests/`
- `playwright/tests/`
- `vision-ai/tests/`
- `frontend/tests/`

### Running Tests

**Run all tests** (recommended):

```bash
./run-tests.sh
```

**Run tests individually**:

```bash
# Python services
cd backend && pytest tests/
cd playwright && pytest tests/
cd vision-ai && pytest tests/

# Frontend
cd frontend && npm test
```

### Requirements

- Python 3.12
- Node.js 20
- Dependencies installed via `pip install -r requirements.txt` and `npm install`

---

## Formatters

### Overview

- **Python**: `Black` - formats all Python code
- **JavaScript**: `Prettier` - formats all frontend code

### Running Formatters

**Run all formatters** (recommended):

```bash
./run-lint-formatter.sh
```

This automatically formats:

- All Python code in `backend/`, `playwright/`, and `vision-ai/`
- All JavaScript code in `frontend/`

**Run individually**:

```bash
# Python
black backend playwright vision-ai

# JavaScript
cd frontend && npx prettier --write .
```

**Check formatting without applying**:

```bash
# Python
black --check backend playwright vision-ai

# JavaScript
cd frontend && npx prettier --check .
```

---

## Linters

### Overview

- **Python**: `Ruff` - lints all Python code
- **JavaScript**: `ESLint` - lints all frontend code

### Running Linters

**Run all linters** (recommended):

```bash
./run-lint-formatter.sh
```

This automatically lints and fixes:

- All Python code in `backend/`, `playwright/`, and `vision-ai/`
- All JavaScript code in `frontend/`

**Run individually**:

```bash
# Python (with auto-fix)
ruff check --fix backend
ruff check --fix playwright
ruff check --fix vision-ai

# JavaScript (with auto-fix)
cd frontend && npx eslint . --fix
```

---

## GitHub Actions Workflows

All checks run automatically on GitHub Actions when:

- Code is pushed to the `main` branch
- A Pull Request is opened targeting the `main` branch

### Workflow Files

Located in `.github/workflows/`:

1. **`test.yml`** - Runs all test suites (pytest for Python, Jest for frontend)
2. **`lint.yml`** - Runs Ruff linter on all Python services
3. **`format.yml`** - Checks formatting (Black for Python, Prettier for JavaScript)

### Important Notes

- **All checks must pass** before a PR can be merged
- If formatting check fails, run `./run-lint-formatter.sh` locally and commit the changes
- If tests fail, fix the issues locally and push again
- View workflow status on the GitHub repository's "Actions" tab or on your Pull Request

---

## Troubleshooting

### Script Permission Errors (Linux/Mac)

**Issue**: `Permission denied` when running scripts

**Solution**:

```bash
chmod +x run-tests.sh
chmod +x run-lint-formatter.sh
```

### Windows Users

**Issue**: Shell scripts don't run on Windows

**Solutions**:

- Use Git Bash or WSL to run the scripts
- Or run commands individually (see sections above)

### Formatting Issues

**Issue**: GitHub Actions format check fails

**Solution**: Run `./run-lint-formatter.sh` locally, commit the formatted changes, and push again.

### Tests Fail Locally

**Issue**: Tests don't run or fail

**Solutions**:

- Ensure Python 3.12 and Node.js 20 are installed
- Install all dependencies: `pip install -r requirements.txt` (for each Python service) and `npm install` (in frontend)
- Verify test files are in the correct `tests/` directories

### Linting Errors

**Issue**: Ruff or ESLint reports errors

**Solution**: Run `./run-lint-formatter.sh` - it automatically fixes most issues. Manually fix any remaining errors.

---

## Summary

The CI/CD pipeline ensures code quality through:

✅ **Automated Testing** - pytest (Python) and Jest (JavaScript)  
✅ **Code Formatting** - Black (Python) and Prettier (JavaScript)  
✅ **Code Linting** - Ruff (Python) and ESLint (JavaScript)  
✅ **GitHub Actions** - All checks run automatically on push/PR

**Always run `./run-lint-formatter.sh` and `./run-tests.sh` before pushing code!**
