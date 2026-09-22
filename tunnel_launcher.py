import os
import sys
import re
import time
import socket
import subprocess
import threading
import webbrowser
from pathlib import Path

# Ensure immediate unbuffered output on Windows
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', line_buffering=True)
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', line_buffering=True)

BASE_DIR = Path(__file__).resolve().parent
PYTHON_EXE = BASE_DIR / "python_runtime" / "python.exe"
if not PYTHON_EXE.exists():
    PYTHON_EXE = Path(sys.executable)

CLOUDFLARED_EXE = BASE_DIR / "bin" / "cloudflared.exe"

def is_port_in_use(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('127.0.0.1', port)) == 0

def open_url_in_browser(url: str):
    """Reliably opens a URL in the default browser on Windows."""
    opened = False
    try:
        opened = webbrowser.open(url)
    except Exception:
        pass
    if not opened and sys.platform.startswith("win"):
        try:
            os.system(f'start "" "{url}"')
        except Exception:
            pass

def main():
    print("=" * 70, flush=True)
    print("   OmniDownloader PRO - Live Public Website Launcher", flush=True)
    print("=" * 70, flush=True)
    print("\n [1/2] Checking backend server...", flush=True)

    server_process = None
    target_port = 8000

    # Start main.py if not already running
    if not is_port_in_use(target_port):
        print(f" [*] Starting Python backend server on port {target_port}...", flush=True)
        server_env = os.environ.copy()
        server_env["IS_TUNNEL_LAUNCH"] = "1"
        server_process = subprocess.Popen(
            [str(PYTHON_EXE), "main.py"],
            cwd=str(BASE_DIR),
            env=server_env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        # Wait for server to become responsive
        for _ in range(30):
            time.sleep(0.5)
            if is_port_in_use(target_port):
                break
        print(" [OK] Backend server is running and ready!", flush=True)
    else:
        print(f" [OK] Backend server is already running on port {target_port}.", flush=True)

    print("\n [2/2] Establishing secure HTTPS Cloudflare Live Link...", flush=True)
    if not CLOUDFLARED_EXE.exists():
        print(f" [!] Error: cloudflared.exe not found at {CLOUDFLARED_EXE}", flush=True)
        print("     Opening local website: http://127.0.0.1:8000", flush=True)
        open_url_in_browser("http://127.0.0.1:8000")
        return

    cmd = [
        str(CLOUDFLARED_EXE),
        "tunnel",
        "--url", f"http://127.0.0.1:{target_port}",
        "--no-autoupdate"
    ]

    tunnel_proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        universal_newlines=True,
        encoding="utf-8",
        errors="ignore",
        cwd=str(BASE_DIR)
    )

    public_url = None
    url_pattern = re.compile(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com")

    def monitor_output():
        nonlocal public_url
        opened = False
        while True:
            line = tunnel_proc.stdout.readline()
            if not line:
                if tunnel_proc.poll() is not None:
                    break
                time.sleep(0.1)
                continue

            match = url_pattern.search(line)
            if match and not opened:
                public_url = match.group(0)
                opened = True
                print("\n" + "=" * 70, flush=True)
                print(" [SUCCESS] YOUR LIVE WEBSITE IS ONLINE & READY!", flush=True)
                print("=" * 70, flush=True)
                print(f"\n   >>> Live Public HTTPS URL: {public_url}", flush=True)
                print(f"   >>> Local Desktop URL:     http://127.0.0.1:{target_port}", flush=True)
                print("\n   [*] Opening website in your default browser now...", flush=True)
                print("   [*] You can also open this link on your mobile phone or share it!", flush=True)
                print("=" * 70, flush=True)
                print("\n (Keep this window open. Press Ctrl+C anytime to stop)\n", flush=True)
                
                time.sleep(1)
                open_url_in_browser(public_url)

    t = threading.Thread(target=monitor_output, daemon=True)
    t.start()

    try:
        while True:
            time.sleep(1)
            if tunnel_proc.poll() is not None:
                break
    except KeyboardInterrupt:
        print("\n\n [*] Stopping services...", flush=True)
    finally:
        if tunnel_proc.poll() is None:
            tunnel_proc.terminate()
        if server_process and server_process.poll() is None:
            server_process.terminate()
        print(" [OK] All services stopped cleanly.", flush=True)

if __name__ == "__main__":
    main()
