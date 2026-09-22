@echo off
title OmniDownloader PRO - Live Public Website Online
cd /d "%~dp0"

IF EXIST "python_runtime\python.exe" (
    "python_runtime\python.exe" tunnel_launcher.py
) ELSE (
    python tunnel_launcher.py
)

pause
