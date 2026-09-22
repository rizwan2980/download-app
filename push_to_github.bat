@echo off
title Push OmniDownloader to GitHub
cd /d "%~dp0"

echo =========================================================
echo   Pushing OmniDownloader PRO to GitHub (rizwan2980/download-app)
echo =========================================================
echo.

set "PATH=%PATH%;C:\Program Files\Git\cmd;C:\Program Files\Git\bin"

git branch -M main
git push -u origin main

echo.
if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] Code uploaded to GitHub successfully!
    echo Now go to Railway to deploy: https://railway.app/new
) else (
    echo [NOTE] If you haven't created the repo yet, please create it at:
    echo https://github.com/new?name=download-app
)

echo.
pause
