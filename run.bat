@echo off
title OmniDownloader PRO - Social Media & Watermark Remover
cd /d "%~dp0"

echo =========================================================
echo   Starting OmniDownloader PRO
echo =========================================================
echo.

IF EXIST "python_runtime\python.exe" (
    "python_runtime\python.exe" main.py
) ELSE (
    python main.py
)

pause
