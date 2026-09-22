import os
import sys
import time
import webbrowser
import threading
import socket
from pathlib import Path

# Add project root to sys.path
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from backend.config import HOST, PORT, get_ffmpeg_path, logger, IS_CLOUD_DEPLOY

def find_available_port(start_port=8000, max_attempts=20):
    """Finds an open port starting from start_port."""
    for port in range(start_port, start_port + max_attempts):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(('0.0.0.0', port))
                return port
            except OSError:
                continue
    return 8000

def open_browser_delayed(url: str, delay_seconds: float = 1.5):
    """Opens browser after the server has initialized (only in local desktop mode)."""
    if os.getenv("IS_TUNNEL_LAUNCH") == "1":
        return
    time.sleep(delay_seconds)
    opened = False
    try:
        opened = webbrowser.open(url)
    except Exception as e:
        logger.debug(f"Could not automatically open browser via webbrowser: {e}")
    if not opened and sys.platform.startswith("win"):
        try:
            os.system(f'start "" "{url}"')
        except Exception:
            pass

if __name__ == "__main__":
    import uvicorn

    # Ensure UTF-8 stdout encoding on Windows
    if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8')

    # Read host and port from environment (Railway injects $PORT)
    env_port = os.getenv("PORT")
    if env_port and env_port.isdigit():
        target_port = int(env_port)
    elif IS_CLOUD_DEPLOY:
        target_port = 8000
    else:
        target_port = find_available_port(8000)

    target_host = os.getenv("HOST", "0.0.0.0")
    ffmpeg_bin = get_ffmpeg_path()

    print("=" * 65)
    print(" [>] OmniDownloader PRO - Production Server")
    print(f" [*] Listening on: http://{target_host}:{target_port}")
    print(f" [*] FFmpeg Engine: {ffmpeg_bin}")
    print(f" [*] Environment: {'Cloud / Railway Container' if IS_CLOUD_DEPLOY else 'Local Desktop'}")
    print("=" * 65)

    # Auto-open browser only when running locally on Windows/Desktop
    if not IS_CLOUD_DEPLOY and sys.platform.startswith("win"):
        threading.Thread(target=open_browser_delayed, args=(f"http://127.0.0.1:{target_port}",), daemon=True).start()

    # Launch uvicorn production server
    uvicorn.run(
        "backend.app:app",
        host=target_host,
        port=target_port,
        log_level=os.getenv("LOG_LEVEL", "info").lower(),
        access_log=True,
        workers=1
    )
