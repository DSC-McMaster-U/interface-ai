@echo off
REM Simple dev commands for Windows

if "%1"=="" goto help
if "%1"=="format" goto format
if "%1"=="lint" goto lint
if "%1"=="test" goto test
goto help

:format
echo Formatting Python...
black backend/ playwright/ vision-ai/ tests/
isort backend/ playwright/ vision-ai/ tests/
echo Formatting JavaScript...
cd frontend && npm run format
goto end

:lint
echo Linting Python...
flake8 backend/ playwright/ vision-ai/ tests/
mypy backend/ playwright/ vision-ai/
echo Linting JavaScript...
cd frontend && npm run lint
goto end

:test
echo Testing Python...
pytest tests/ -v
echo Testing JavaScript...
cd frontend && npm test
goto end

:help
echo Commands:
echo   dev format  - Format all code
echo   dev lint    - Lint all code
echo   dev test    - Run all tests
goto end

:end
