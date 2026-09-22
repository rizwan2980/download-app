import os
import sys
import re
import shutil
import subprocess
import time
from pathlib import Path
from backend.config import get_ffmpeg_path, load_settings, logger, IS_CLOUD_DEPLOY

def detect_platform(url: str) -> dict:
    """Detects platform and returns metadata info."""
    url = url.strip()
    if not url:
        return {"platform": "generic", "name": "Web Video", "icon": "fa-circle-play", "color": "#718096", "supports_clean_watermark": False}
        
    patterns = [
        (r'(dola\.com|dola\.ai)', "dola", "Dola AI Video", "fa-robot", "#8b5cf6"),
        (r'(luma\.ai|lumalabs\.ai)', "luma", "Luma Dream Machine", "fa-robot", "#ec4899"),
        (r'(runwayml\.com|runway\.com)', "runway", "Runway AI", "fa-robot", "#6366f1"),
        (r'(klingai\.com|kling\.ai)', "kling", "Kling AI", "fa-robot", "#3b82f6"),
        (r'(sora\.com)', "sora", "OpenAI Sora", "fa-robot", "#10a37f"),
        (r'(pika\.art)', "pika", "Pika AI", "fa-robot", "#f59e0b"),
        (r'(hailuoai\.com|minimax\.chat)', "hailuo", "Hailuo AI", "fa-robot", "#06b6d4"),
        (r'(heygen\.com)', "heygen", "HeyGen AI", "fa-robot", "#8b5cf6"),
        (r'(d-id\.com)', "did", "D-ID Video", "fa-robot", "#10b981"),
        (r'(viggle\.ai)', "viggle", "Viggle AI", "fa-robot", "#f43f5e"),
        (r'(tiktok\.com|douyin\.com|v\.douyin\.com|vt\.tiktok\.com)', "tiktok", "TikTok", "fa-tiktok", "#fe2c55"),
        (r'(instagram\.com|instagr\.am)', "instagram", "Instagram", "fa-instagram", "#e1306c"),
        (r'(youtube\.com|youtu\.be)', "youtube", "YouTube", "fa-youtube", "#ff0000"),
        (r'(facebook\.com|fb\.watch|fb\.com)', "facebook", "Facebook", "fa-facebook", "#1877f2"),
        (r'(twitter\.com|x\.com)', "twitter", "X / Twitter", "fa-x-twitter", "#1da1f2"),
        (r'(pinterest\.com|pin\.it)', "pinterest", "Pinterest", "fa-pinterest", "#e60023"),
        (r'(reddit\.com|redd\.it)', "reddit", "Reddit", "fa-reddit-alien", "#ff4500"),
        (r'(threads\.net)', "threads", "Threads", "fa-at", "#000000"),
        (r'(snapchat\.com)', "snapchat", "Snapchat", "fa-snapchat", "#fffc00"),
        (r'(vimeo\.com)', "vimeo", "Vimeo", "fa-vimeo-v", "#1ab7ea"),
        (r'(dailymotion\.com|dai\.ly)', "dailymotion", "Dailymotion", "fa-play", "#0066dc"),
        (r'(soundcloud\.com)', "soundcloud", "SoundCloud", "fa-soundcloud", "#ff5500"),
        (r'(linkedin\.com)', "linkedin", "LinkedIn", "fa-linkedin-in", "#0a66c2")
    ]
    
    for regex, platform_id, name, icon, color in patterns:
        if re.search(regex, url, re.IGNORECASE):
            return {
                "platform": platform_id,
                "name": name,
                "icon": icon,
                "color": color,
                "supports_clean_watermark": platform_id in ["tiktok", "instagram", "douyin", "snapchat", "dola"]
            }
            
    return {
        "platform": "generic",
        "name": "Web Video",
        "icon": "fa-circle-play",
        "color": "#6366f1",
        "supports_clean_watermark": False
    }

def format_bytes(size: float) -> str:
    """Formats bytes into human readable string (KB, MB, GB)."""
    if not size or size <= 0:
        return "0 B"
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if size < 1024.0:
            return f"{size:.2f} {unit}"
        size /= 1024.0
    return f"{size:.2f} PB"

def format_duration(seconds: float) -> str:
    """Formats seconds into MM:SS or HH:MM:SS."""
    if not seconds or seconds <= 0:
        return "00:00"
    seconds = int(seconds)
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"

def open_in_explorer(file_or_dir_path: str) -> bool:
    """Opens system file manager if running locally. Graceful no-op in cloud container."""
    if IS_CLOUD_DEPLOY:
        logger.debug("Cloud deployment active: open_in_explorer is disabled.")
        return False

    try:
        path = Path(file_or_dir_path).resolve()
        if sys.platform == "win32":
            if path.is_file():
                subprocess.run(["explorer.exe", f"/select,{str(path)}"], check=False)
            elif path.is_dir():
                subprocess.run(["explorer.exe", str(path)], check=False)
            else:
                parent = path.parent
                if parent.exists():
                    subprocess.run(["explorer.exe", str(parent)], check=False)
            return True
        elif sys.platform == "darwin":
            subprocess.run(["open", str(path)], check=False)
            return True
        elif sys.platform.startswith("linux"):
            if os.getenv("DISPLAY"):
                subprocess.run(["xdg-open", str(path)], check=False)
                return True
    except Exception as e:
        logger.debug(f"Could not open explorer: {e}")
    return False

def sanitize_filename(name: str) -> str:
    """Sanitizes filename for safe web URLs and safe storage across Linux/Docker/Windows."""
    if not name:
        return "media_download"
    # Remove directory traversal, hashtag, question mark, percentage, ampersand, quotes, brackets, control chars
    clean = re.sub(r'[\x00-\x1f\x7f\\/*?:"<>|#%&={}\'$`!@^~;,]', "", name)
    # Remove emojis or non-ascii special characters that break URL encoding
    clean = re.sub(r'[^\w\s.-]', '', clean)
    # Remove leading/trailing dots, dashes, or whitespace
    clean = clean.strip(" .-_")
    # Replace multiple whitespace with single space
    clean = re.sub(r'\s+', " ", clean)
    clean = clean.strip()
    return clean[:80] if len(clean) > 80 else clean or "media_download"

def generate_video_thumbnail(video_path: str, thumb_path: str) -> bool:
    """Generates a thumbnail image from a video using FFmpeg."""
    ffmpeg = get_ffmpeg_path()
    try:
        cmd = [
            ffmpeg, "-y",
            "-ss", "00:00:01",
            "-i", str(video_path),
            "-vframes", "1",
            "-q:v", "2",
            str(thumb_path)
        ]
        res = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=10)
        return Path(thumb_path).exists() and Path(thumb_path).stat().st_size > 0
    except Exception as e:
        logger.debug(f"Thumbnail generation error: {e}")
        return False

def get_disk_info(path: Path) -> dict:
    """Returns total and free disk space in MB."""
    try:
        total, used, free = shutil.disk_usage(path)
        return {
            "total_mb": round(total / (1024 * 1024), 2),
            "free_mb": round(free / (1024 * 1024), 2),
            "used_mb": round(used / (1024 * 1024), 2)
        }
    except Exception:
        return {"total_mb": 0, "free_mb": 0, "used_mb": 0}
