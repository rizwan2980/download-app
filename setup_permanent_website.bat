@echo off
title Setup Permanent Professional Website Link - OmniDownloader PRO
cd /d "%~dp0"

echo =====================================================================
echo    OmniDownloader PRO - Automated Permanent Website Setup
echo =====================================================================
echo.
echo Step 1: Connecting to GitHub...
echo.

set "PATH=%PATH%;C:\Program Files\Git\cmd;C:\Program Files\Git\bin;C:\Program Files\GitHub CLI"

"C:\Program Files\GitHub CLI\gh.exe" auth status >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [*] Logging into GitHub via Browser...
    echo [*] A one-time code will appear below. Enter it in the browser window.
    echo.
    "C:\Program Files\GitHub CLI\gh.exe" auth login --web --git-protocol https
) else (
    echo [OK] Already logged into GitHub.
)

echo.
echo Step 2: Uploading code to GitHub repository...
git branch -M main
git push -u origin main
if %ERRORLEVEL% NEQ 0 (
    echo [*] Creating GitHub repository 'download-app'...
    "C:\Program Files\GitHub CLI\gh.exe" repo create download-app --public --source=. --remote=origin --push
)

echo.
echo =====================================================================
echo [SUCCESS] Code is uploaded to GitHub successfully!
echo =====================================================================
echo.
echo Opening Railway in your browser now...
start https://railway.app/new
echo.
echo ---------------------------------------------------------------------
echo Next Steps on Railway:
echo 1. Click 'Deploy from GitHub repo'
echo 2. Select 'download-app'
echo 3. Click 'Deploy Now'
echo 4. In Settings -^> Networking, click 'Generate Domain' to get your FIXED URL!
echo ---------------------------------------------------------------------
echo.
pause
