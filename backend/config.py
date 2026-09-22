import os
import sys
import json
import shutil
import logging
from pathlib import Path

# Load environment variables if .env exists
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Base directory
BASE_DIR = Path(__file__).resolve().parent.parent

# Bin directory (for local Windows standalone ffmpeg & deno if present)
BIN_DIR = BASE_DIR / "bin"
BIN_DIR.mkdir(parents=True, exist_ok=True)

# Automatically prepend BIN_DIR to PATH
bin_str = str(BIN_DIR.resolve())
if bin_str not in os.environ.get("PATH", ""):
    os.environ["PATH"] = bin_str + os.pathsep + os.environ.get("PATH", "")

# Setup structured logger
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("OmniDownloader")

# Configurable downloads directory (defaults to 'downloads' inside project root)
CUSTOM_DOWNLOADS_DIR = os.getenv("DOWNLOADS_DIR")
if CUSTOM_DOWNLOADS_DIR:
    DOWNLOADS_DIR = Path(CUSTOM_DOWNLOADS_DIR).resolve()
else:
    DOWNLOADS_DIR = BASE_DIR / "downloads"

DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)

SETTINGS_FILE = BASE_DIR / "settings.json"

# Server configuration
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")

# Automatic cleanup retention settings
MAX_FILE_AGE_MINUTES = int(os.getenv("MAX_FILE_AGE_MINUTES", "60"))  # Clean files older than 60 mins
CLEANUP_INTERVAL_MINUTES = int(os.getenv("CLEANUP_INTERVAL_MINUTES", "15"))  # Scan every 15 mins
MAX_FILE_SIZE_MB = int(os.getenv("MAX_FILE_SIZE_MB", "500"))

# Is running inside cloud/container environment
IS_CLOUD_DEPLOY = bool(os.getenv("RAILWAY_ENVIRONMENT") or os.getenv("RENDER") or os.getenv("FLY_APP_NAME") or os.getenv("DOCKER_CONTAINER") or not sys.platform.startswith("win"))

def get_ffmpeg_path() -> str:
    """Finds ffmpeg binary in local bin/, system PATH, or env variable."""
    # 1. Local bin/ directory (Windows portable)
    local_ffmpeg = BIN_DIR / "ffmpeg.exe"
    if local_ffmpeg.exists():
        return str(local_ffmpeg)

    # 2. Custom ENV override
    env_ffmpeg = os.getenv("FFMPEG_PATH")
    if env_ffmpeg and Path(env_ffmpeg).exists():
        return env_ffmpeg

    # 3. System PATH (Linux/Docker/Mac/Windows global)
    system_ffmpeg = shutil.which("ffmpeg")
    if system_ffmpeg:
        return system_ffmpeg

    # 4. Standard Linux locations
    for linux_path in ["/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/bin/ffmpeg"]:
        if Path(linux_path).exists():
            return linux_path

    return "ffmpeg"

def get_ffprobe_path() -> str:
    """Finds ffprobe binary in local bin/, system PATH, or env variable."""
    local_ffprobe = BIN_DIR / "ffprobe.exe"
    if local_ffprobe.exists():
        return str(local_ffprobe)

    env_ffprobe = os.getenv("FFPROBE_PATH")
    if env_ffprobe and Path(env_ffprobe).exists():
        return env_ffprobe

    system_ffprobe = shutil.which("ffprobe")
    if system_ffprobe:
        return system_ffprobe

    for linux_path in ["/usr/bin/ffprobe", "/usr/local/bin/ffprobe", "/bin/ffprobe"]:
        if Path(linux_path).exists():
            return linux_path

    return "ffprobe"

DEFAULT_SETTINGS = {
    "download_dir": str(DOWNLOADS_DIR),
    "default_quality": os.getenv("DEFAULT_QUALITY", "best"),
    "auto_remove_watermark": os.getenv("AUTO_REMOVE_WATERMARK", "true").lower() == "true",
    "theme": "dark",
    "audio_bitrate": os.getenv("DEFAULT_AUDIO_BITRATE", "320"),
    "max_file_age_minutes": MAX_FILE_AGE_MINUTES,
    "gemini_api_key": os.getenv("GEMINI_API_KEY", ""),
    "openai_api_key": os.getenv("OPENAI_API_KEY", ""),
    "ai_vision_provider": os.getenv("AI_VISION_PROVIDER", "openai")
}

def load_settings():
    if SETTINGS_FILE.exists():
        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return {**DEFAULT_SETTINGS, **data}
        except Exception as e:
            logger.warning(f"Could not parse settings.json: {e}")
            return DEFAULT_SETTINGS.copy()
    return DEFAULT_SETTINGS.copy()

def save_settings(new_settings):
    current = load_settings()
    current.update(new_settings)
    try:
        with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(current, f, indent=4)
    except Exception as e:
        logger.warning(f"Could not save settings.json: {e}")
    return current
