@echo off
REM Simple dev commands for Windows

if "%1"=="" goto help
if "%1"=="check" goto check
if "%1"=="format" goto format
if "%1"=="test" goto test
goto help

:check
echo Checking Python (no changes)...
python -m ruff check backend/ playwright/ vision-ai/ tests/
python -m ruff format --check backend/ playwright/ vision-ai/ tests/
goto end

:format
echo Formatting Python...
python -m ruff check backend/ playwright/ vision-ai/ tests/ --fix
python -m ruff format backend/ playwright/ vision-ai/ tests/
goto end

:test
echo Testing Python...
python -m pytest tests/ -v
goto end

:help
echo Commands:
echo   dev check   - Check for issues (no changes)
echo   dev format  - Auto-fix and format Python
echo   dev test    - Run Python tests
goto end

:end
