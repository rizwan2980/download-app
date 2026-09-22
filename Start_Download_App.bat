@echo off
title OmniDownloader PRO - Live Public Website
cd /d "C:\Users\Rizwan pc\.gemini\antigravity-ide\scratch\download_app"

echo ======================================================================
echo    Starting OmniDownloader PRO + Live Cloudflare Public Tunnel...
echo ======================================================================

start "OmniDownloader Backend" /min "C:\Users\Rizwan pc\.gemini\antigravity-ide\scratch\app_venv\Scripts\python.exe" main.py
timeout /t 2 /nobreak >nul

start "Cloudflare Live Tunnel" /min "C:\Users\Rizwan pc\.gemini\antigravity-ide\scratch\download_app\bin\cloudflared.exe" tunnel --url http://127.0.0.1:8000 --protocol http2 --no-autoupdate
timeout /t 3 /nobreak >nul

start https://rizwan2980.github.io/omnidownloader/

echo.
echo [SUCCESS] Your Official Website is LIVE!
echo.
echo Official URL: https://rizwan2980.github.io/omnidownloader/
echo Local URL:    http://127.0.0.1:8000
echo.
echo Keep this window open while you want the website online.
echo ======================================================================
pause
