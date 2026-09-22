import os
import time
import threading
import logging
from pathlib import Path
from backend.config import DOWNLOADS_DIR, MAX_FILE_AGE_MINUTES, CLEANUP_INTERVAL_MINUTES, logger

def cleanup_old_files(max_age_seconds: int = None):
    """Scans the downloads directory and removes files older than max_age_seconds."""
    if max_age_seconds is None:
        max_age_seconds = MAX_FILE_AGE_MINUTES * 60

    if not DOWNLOADS_DIR.exists():
        return 0

    now = time.time()
    deleted_count = 0
    reclaimed_bytes = 0

    try:
        for file in DOWNLOADS_DIR.iterdir():
            # Skip hidden files or gitkeep
            if file.name.startswith(".") or file.name == ".gitkeep":
                continue

            if file.is_file():
                try:
                    stat = file.stat()
                    file_age = now - stat.st_mtime
                    file_size = stat.st_size

                    # Delete if older than max age or incomplete temp download files older than 10 mins
                    is_temp_fragment = file.suffix.lower() in [".part", ".ytdl", ".tmp", ".temp"]
                    should_delete = False

                    if is_temp_fragment and file_age > 600:
                        should_delete = True
                    elif file_age > max_age_seconds:
                        should_delete = True

                    if should_delete:
                        file.unlink(missing_ok=True)
                        deleted_count += 1
                        reclaimed_bytes += file_size
                        logger.info(f"[Auto-Cleanup] Removed expired file: {file.name} ({file_size / (1024*1024):.2f} MB)")
                except Exception as file_err:
                    logger.debug(f"Could not inspect/delete {file.name}: {file_err}")

        if deleted_count > 0:
            logger.info(f"[Auto-Cleanup] Total {deleted_count} files removed, reclaimed {reclaimed_bytes / (1024*1024):.2f} MB")
    except Exception as e:
        logger.error(f"[Auto-Cleanup] Scan error: {e}")

    return deleted_count

def _cleanup_worker_loop():
    """Background worker loop for periodic retention cleanup."""
    logger.info(f"[Auto-Cleanup] Service started. Scan interval: {CLEANUP_INTERVAL_MINUTES}m, Retention: {MAX_FILE_AGE_MINUTES}m")
    while True:
        try:
            cleanup_old_files()
        except Exception as e:
            logger.error(f"[Auto-Cleanup] Loop error: {e}")
        time.sleep(CLEANUP_INTERVAL_MINUTES * 60)

def start_cleanup_scheduler():
    """Starts the background retention cleanup daemon thread."""
    t = threading.Thread(target=_cleanup_worker_loop, daemon=True, name="OmniCleanupWorker")
    t.start()
    return t
