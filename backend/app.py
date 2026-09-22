import os
import sys
import time
import urllib.parse
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, HTTPException, BackgroundTasks, UploadFile, File, Form, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from backend.config import (
    BASE_DIR, DOWNLOADS_DIR, HOST, PORT, CORS_ORIGINS,
    load_settings, save_settings, get_ffmpeg_path, get_ffprobe_path,
    logger, IS_CLOUD_DEPLOY, MAX_FILE_AGE_MINUTES
)
from backend.utils import (
    detect_platform, format_bytes, format_duration,
    open_in_explorer, sanitize_filename, generate_video_thumbnail, get_disk_info
)
from backend.downloader import (
    create_job, get_job, start_download_thread, extract_video_info, update_job, JOBS, JOBS_LOCK
)
from backend.watermark_remover import (
    create_wm_job, get_wm_job, start_watermark_removal_thread, detect_watermarks_in_video, WATERMARK_JOBS, WM_LOCK
)
from backend.prompt_generator import (
    create_prompt_job, get_prompt_job, start_prompt_thread, extract_video_metadata, PROMPT_JOBS
)
from backend.cleanup import start_cleanup_scheduler, cleanup_old_files

# Initialize FastAPI App
app = FastAPI(
    title="OmniDownloader PRO - Social Media & Watermark Remover",
    description="Production-ready multi-platform video downloader and watermark removal studio API",
    version="1.0.0"
)

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static and media directories
STATIC_DIR = BASE_DIR / "static"
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
app.mount("/media", StaticFiles(directory=str(DOWNLOADS_DIR)), name="media")

# Start background retention cleanup daemon on app initialization
@app.on_event("startup")
def on_startup():
    logger.info("Initializing OmniDownloader PRO backend...")
    logger.info(f"Storage Directory: {DOWNLOADS_DIR}")
    logger.info(f"FFmpeg Path: {get_ffmpeg_path()}")
    start_cleanup_scheduler()

# Models
class URLRequest(BaseModel):
    url: str

class DownloadRequest(BaseModel):
    url: str
    format_id: Optional[str] = "best_video"
    is_audio: Optional[bool] = False
    remove_watermark_source: Optional[bool] = True

class BatchDownloadRequest(BaseModel):
    urls: List[str]
    format_id: Optional[str] = "best_video"
    is_audio: Optional[bool] = False
    remove_watermark_source: Optional[bool] = True

class WatermarkRemovalRequest(BaseModel):
    video_filename: str
    mode: Optional[str] = "delogo"  # 'delogo' | 'blur'
    x: Optional[int] = 0
    y: Optional[int] = 0
    w: Optional[int] = 140
    h: Optional[int] = 80
    boxes: Optional[List[dict]] = None
    enhance_mode: Optional[str] = "none"  # "none" | "hd_sharpen" | "4k_upscale" | "4k_hdr"

class WatermarkDetectRequest(BaseModel):
    video_filename: str

class PromptGenRequest(BaseModel):
    video_filename: Optional[str] = None
    video_path: Optional[str] = None
    duration: Optional[str] = "15s"  # "10s" | "15s" | "30s"
    gemini_api_key: Optional[str] = None
    openai_api_key: Optional[str] = None
    provider: Optional[str] = "openai"  # "openai" | "gemini" | "local"

class KeyVerifyRequest(BaseModel):
    key: str
    provider: Optional[str] = "openai"  # "openai" | "gemini"

class SettingsRequest(BaseModel):
    download_dir: Optional[str] = None
    default_quality: Optional[str] = None
    auto_remove_watermark: Optional[bool] = None
    theme: Optional[str] = None
    audio_bitrate: Optional[str] = None
    gemini_api_key: Optional[str] = None
    openai_api_key: Optional[str] = None
    ai_vision_provider: Optional[str] = None

class ActionRequest(BaseModel):
    filename: Optional[str] = None
    folder_path: Optional[str] = None

# Routes

@app.get("/")
def serve_index():
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(
            str(index_file),
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            }
        )
    return {"message": "OmniDownloader API is running"}

@app.get("/health")
def health_check():
    """Production health check endpoint for Railway and cloud monitors."""
    ffmpeg_bin = get_ffmpeg_path()
    ffmpeg_ok = Path(ffmpeg_bin).exists() or bool(ffmpeg_bin == "ffmpeg")
    disk_stats = get_disk_info(DOWNLOADS_DIR)

    return {
        "status": "healthy",
        "service": "OmniDownloader PRO",
        "timestamp": int(time.time()),
        "ffmpeg_available": ffmpeg_ok,
        "ffmpeg_path": ffmpeg_bin,
        "downloads_dir": str(DOWNLOADS_DIR),
        "disk_free_mb": disk_stats.get("free_mb", 0),
        "retention_minutes": MAX_FILE_AGE_MINUTES,
        "is_cloud": IS_CLOUD_DEPLOY,
        "version": "1.0.0"
    }

@app.post("/api/extract-info")
def api_extract_info(req: URLRequest):
    url = req.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL cannot be empty")
    logger.info(f"Extracting metadata for URL: {url[:60]}...")
    info = extract_video_info(url)
    return info

@app.post("/api/download")
def api_download(req: DownloadRequest):
    url = req.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL cannot be empty")
    
    options = {
        "format_id": req.format_id,
        "is_audio": req.is_audio,
        "remove_watermark_source": req.remove_watermark_source
    }
    
    job_id = create_job(url, options)
    start_download_thread(job_id)
    logger.info(f"Started download job {job_id} for {url[:50]}")
    return {"job_id": job_id, "status": "started"}

@app.get("/api/job/{job_id}")
def api_get_job(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@app.post("/api/cancel/{job_id}")
def api_cancel_job(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    update_job(job_id, cancelled=True, status="cancelled")
    logger.info(f"Cancelled job {job_id}")
    return {"status": "cancelled", "job_id": job_id}

@app.post("/api/batch-download")
def api_batch_download(req: BatchDownloadRequest):
    urls = [u.strip() for u in req.urls if u.strip()]
    if not urls:
        raise HTTPException(status_code=400, detail="No valid URLs provided")
    
    job_ids = []
    for u in urls:
        options = {
            "format_id": req.format_id,
            "is_audio": req.is_audio,
            "remove_watermark_source": req.remove_watermark_source
        }
        jid = create_job(u, options)
        start_download_thread(jid)
        job_ids.append(jid)
        
    logger.info(f"Batch queued: {len(job_ids)} items")
    return {"job_ids": job_ids, "count": len(job_ids)}

@app.post("/api/watermark/remove")
def api_remove_watermark(req: WatermarkRemovalRequest):
    clean_name = os.path.basename(req.video_filename.strip())
    video_path = DOWNLOADS_DIR / clean_name
    
    if not video_path.exists() or not video_path.is_file():
        target = DOWNLOADS_DIR / sanitize_filename(clean_name)
        if target.exists() and target.is_file():
            video_path = target
        else:
            matches = list(DOWNLOADS_DIR.glob(f"*{clean_name}*"))
            if not matches:
                raw_stem = Path(clean_name).stem.replace("upload_", "")
                matches = list(DOWNLOADS_DIR.glob(f"*{raw_stem}*"))
            if matches and matches[0].is_file():
                video_path = matches[0]
            else:
                raise HTTPException(status_code=404, detail=f"Video file '{req.video_filename}' not found in storage")
        
    boxes = req.boxes or []
    if not boxes:
        boxes = [{
            "id": "box_1",
            "name": "Watermark Area",
            "mode": req.mode or "delogo",
            "x": req.x or 0,
            "y": req.y or 0,
            "w": req.w or 140,
            "h": req.h or 80
        }]
        
    params = {
        "boxes": boxes,
        "enhance_mode": req.enhance_mode or "none",
        "mode": req.mode or "delogo"
    }
    
    job_id = create_wm_job(str(video_path), params)
    start_watermark_removal_thread(job_id)
    logger.info(f"Started multi-box watermark removal & enhancement job {job_id} on {video_path.name} (Boxes: {len(boxes)}, Enhance: {req.enhance_mode})")
    return {"job_id": job_id, "status": "started"}

@app.post("/api/watermark/detect")
def api_detect_watermarks(req: WatermarkDetectRequest):
    """Intelligently scans video to detect watermark and logo bounding boxes."""
    clean_name = os.path.basename(req.video_filename.strip())
    video_path = DOWNLOADS_DIR / clean_name
    
    if not video_path.exists() or not video_path.is_file():
        target = DOWNLOADS_DIR / sanitize_filename(clean_name)
        if target.exists() and target.is_file():
            video_path = target
        else:
            matches = list(DOWNLOADS_DIR.glob(f"*{clean_name}*"))
            if not matches:
                raw_stem = Path(clean_name).stem.replace("upload_", "")
                matches = list(DOWNLOADS_DIR.glob(f"*{raw_stem}*"))
            if matches and matches[0].is_file():
                video_path = matches[0]
            else:
                raise HTTPException(status_code=404, detail=f"Video file '{req.video_filename}' not found in storage")
        
    boxes = detect_watermarks_in_video(str(video_path.resolve()))
    logger.info(f"Auto-detected {len(boxes)} watermark zones in {clean_name}")
    return {
        "success": True,
        "filename": req.video_filename,
        "count": len(boxes),
        "boxes": boxes
    }

@app.get("/api/watermark/job/{job_id}")
def api_get_watermark_job(job_id: str):
    job = get_wm_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Watermark job not found")
    return job

@app.post("/api/watermark/upload")
async def api_upload_custom_video(file: UploadFile = File(...)):
    """Allows user to upload a local authorized video for watermark/logo editing."""
    clean_name = sanitize_filename(file.filename or "uploaded_video.mp4")
    if not clean_name.lower().endswith((".mp4", ".mov", ".mkv", ".webm", ".avi")):
        clean_name += ".mp4"
        
    save_path = DOWNLOADS_DIR / f"upload_{int(time.time())}_{clean_name}"
    
    with open(save_path, "wb") as f:
        content = await file.read()
        f.write(content)
        
    logger.info(f"Uploaded video saved to {save_path.name}")
    return {
        "success": True,
        "filename": save_path.name,
        "filepath": str(save_path.resolve()),
        "url": f"/media/{save_path.name}"
    }

# =======================================================
# AI VIDEO-TO-PROMPT GENERATOR ENDPOINTS
# =======================================================

@app.post("/api/prompt/upload")
async def api_upload_prompt_video(file: UploadFile = File(...)):
    """Uploads video for AI prompt analysis."""
    clean_name = sanitize_filename(file.filename or "analysis_video.mp4")
    if not clean_name.lower().endswith((".mp4", ".mov", ".mkv", ".webm", ".avi")):
        clean_name += ".mp4"
        
    save_path = DOWNLOADS_DIR / f"prompt_src_{int(time.time())}_{clean_name}"
    
    with open(save_path, "wb") as f:
        content = await file.read()
        f.write(content)
        
    meta = extract_video_metadata(str(save_path))
    logger.info(f"Uploaded video for AI Prompt analysis: {save_path.name}")
    return {
        "success": True,
        "filename": save_path.name,
        "filepath": str(save_path.resolve()),
        "url": f"/media/{save_path.name}",
        "metadata": meta
    }

@app.post("/api/prompt/generate")
def api_generate_prompt(req: PromptGenRequest):
    """Initiates AI Video-to-Prompt generation job."""
    video_path = None
    if req.video_filename:
        target = DOWNLOADS_DIR / os.path.basename(req.video_filename.strip())
        if target.exists() and target.is_file():
            video_path = str(target.resolve())
            
    if not video_path and req.video_path:
        target = Path(req.video_path.strip())
        if target.exists() and target.is_file():
            video_path = str(target.resolve())

    if not video_path:
        # Check if partial filename exists in downloads
        if req.video_filename:
            matches = list(DOWNLOADS_DIR.glob(f"*{os.path.basename(req.video_filename)}*"))
            if matches and matches[0].is_file():
                video_path = str(matches[0].resolve())

    if not video_path or not os.path.exists(video_path):
        raise HTTPException(status_code=404, detail="Video file not found in storage. Please upload or select a valid video.")

    duration_choice = req.duration if req.duration in ["10s", "15s", "30s"] else "15s"
    job_id = create_prompt_job(
        video_path,
        duration_target=duration_choice,
        custom_openai_key=req.openai_api_key,
        custom_gemini_key=req.gemini_api_key,
        provider=req.provider or "openai"
    )
    start_prompt_thread(job_id)
    logger.info(f"Started AI Prompt Generation job {job_id} for duration {duration_choice} on {os.path.basename(video_path)}")
    return {
        "success": True,
        "job_id": job_id,
        "status": "started",
        "duration": duration_choice
    }

@app.get("/api/prompt/job/{job_id}")
def api_get_prompt_job(job_id: str):
    """Retrieves current status, progress, and result of AI prompt generation job."""
    job = get_prompt_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Prompt generation job not found")
    return job

@app.post("/api/prompt/verify-key")
def api_verify_key(req: KeyVerifyRequest):
    """Tests if an OpenAI or Gemini API key is valid by calling a lightweight model check."""
    import requests
    from backend.prompt_generator import clean_openai_api_key, clean_gemini_api_key

    provider = (req.provider or "openai").lower()

    if provider == "openai":
        clean = clean_openai_api_key(req.key)
        if not clean:
            return {"valid": False, "error": "Please enter a valid OpenAI API Key (starts with sk- or sk-proj-...)"}
        
        url = "https://api.openai.com/v1/models"
        headers = {"Authorization": f"Bearer {clean}"}
        try:
            r = requests.get(url, headers=headers, timeout=10)
            if r.status_code == 200:
                save_settings({"openai_api_key": clean, "ai_vision_provider": "openai"})
                return {"valid": True, "clean_key": clean, "provider": "openai", "message": "OpenAI GPT-4o Vision API Key is valid and active!"}
            else:
                try:
                    err_data = r.json()
                    err_msg = err_data.get("error", {}).get("message", f"OpenAI Error: HTTP {r.status_code}")
                except Exception:
                    err_msg = f"OpenAI Error: HTTP {r.status_code}"
                return {"valid": False, "error": err_msg}
        except Exception as e:
            return {"valid": False, "error": f"Connection error: {str(e)}"}

    else:  # Gemini
        clean = clean_gemini_api_key(req.key)
        if not clean:
            return {"valid": False, "error": "Please enter a valid Gemini API Key (starts with AIzaSy...)"}
        
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={clean}"
        try:
            r = requests.post(url, json={"contents": [{"parts": [{"text": "hi"}]}]}, timeout=10)
            if r.status_code == 200:
                save_settings({"gemini_api_key": clean, "ai_vision_provider": "gemini"})
                return {"valid": True, "clean_key": clean, "provider": "gemini", "message": "Google Gemini Vision API Key is valid and active!"}
            else:
                try:
                    err_data = r.json()
                    err_msg = err_data.get("error", {}).get("message", f"Gemini Error: HTTP {r.status_code}")
                except Exception:
                    err_msg = f"Gemini Error: HTTP {r.status_code}"
                return {"valid": False, "error": err_msg}
        except Exception as e:
            return {"valid": False, "error": f"Connection error: {str(e)}"}

@app.get("/api/media/download/{filename:path}")
def api_download_media_attachment(filename: str):
    """Provides direct file attachment download to user's device (phone/PC) with proper MIME headers."""
    clean_name = os.path.basename(filename.strip())
    target = DOWNLOADS_DIR / clean_name
    
    if not target.exists() or not target.is_file():
        target = DOWNLOADS_DIR / sanitize_filename(clean_name)
        
    if not target.exists() or not target.is_file():
        matches = list(DOWNLOADS_DIR.glob(f"*{clean_name}*"))
        if matches and matches[0].is_file():
            target = matches[0]

    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="Media file not found on server")

    ext = target.suffix.lower()
    mime_map = {
        ".mp4": "video/mp4",
        ".mkv": "video/x-matroska",
        ".webm": "video/webm",
        ".mov": "video/quicktime",
        ".avi": "video/x-msvideo",
        ".mp3": "audio/mpeg",
        ".m4a": "audio/mp4",
        ".wav": "audio/wav",
        ".aac": "audio/aac",
        ".flac": "audio/flac",
        ".opus": "audio/opus"
    }
    media_type = mime_map.get(ext, "application/octet-stream")

    safe_name = re.sub(r'[^a-zA-Z0-9_.-]', '_', target.name)
    quoted_name = urllib.parse.quote(target.name)
    return FileResponse(
        path=str(target.resolve()),
        filename=safe_name,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{safe_name}"; filename*=UTF-8\'\'{quoted_name}',
            "Access-Control-Expose-Headers": "Content-Disposition",
            "Cache-Control": "no-cache"
        }
    )

@app.get("/api/library")
def api_get_library(files: Optional[str] = None):
    """Returns list of downloaded & processed media.
    When 'files' is provided (comma-separated list of filenames), returns info ONLY for the user's private files.
    When 'files' is not provided in cloud mode, returns empty list to guarantee complete privacy between users."""
    allowed_files = set([f.strip() for f in files.split(",") if f.strip()]) if files else None
    items = []
    if DOWNLOADS_DIR.exists():
        for file in sorted(DOWNLOADS_DIR.iterdir(), key=os.path.getmtime, reverse=True):
            if file.is_file() and not file.name.startswith(".") and file.name != ".gitkeep":
                if allowed_files is not None and file.name not in allowed_files:
                    continue
                if allowed_files is None and IS_CLOUD_DEPLOY:
                    continue
                
                ext = file.suffix.lower()
                is_video = ext in [".mp4", ".mkv", ".webm", ".mov", ".avi"]
                is_audio = ext in [".mp3", ".m4a", ".wav", ".aac", ".flac", ".opus"]
                
                if is_video or is_audio:
                    stat = file.stat()
                    encoded_name = urllib.parse.quote(file.name)
                    items.append({
                        "filename": file.name,
                        "filepath": str(file.resolve()),
                        "size": format_bytes(stat.st_size),
                        "size_bytes": stat.st_size,
                        "created_at": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(stat.st_mtime)),
                        "type": "video" if is_video else "audio",
                        "ext": ext.replace(".", ""),
                        "url": f"/media/{encoded_name}",
                        "download_url": f"/api/media/download/{encoded_name}",
                        "is_nowm": "_nowm_" in file.name
                    })
    return {"items": items, "count": len(items), "folder": str(DOWNLOADS_DIR.resolve()) if not IS_CLOUD_DEPLOY else "Private Cloud Storage"}

@app.post("/api/open-explorer")
def api_open_explorer(req: ActionRequest):
    target = DOWNLOADS_DIR
    if req.filename:
        target = DOWNLOADS_DIR / req.filename
    elif req.folder_path:
        target = Path(req.folder_path)
        
    opened = open_in_explorer(str(target))
    return {
        "success": True,
        "opened_locally": opened,
        "message": "Opened file in file explorer." if opened else "Cloud mode active: Files can be downloaded or previewed directly via the browser."
    }

@app.delete("/api/media/{filename}")
def api_delete_media(filename: str):
    target = DOWNLOADS_DIR / filename
    if target.exists() and target.is_file():
        target.unlink(missing_ok=True)
        logger.info(f"Deleted media file: {filename}")
        return {"success": True, "message": f"Deleted {filename}"}
    raise HTTPException(status_code=404, detail="File not found")

@app.get("/api/settings")
def api_get_settings():
    settings = load_settings()
    ffmpeg_bin = get_ffmpeg_path()
    settings["ffmpeg_path"] = ffmpeg_bin
    settings["ffmpeg_available"] = Path(ffmpeg_bin).exists() or bool(ffmpeg_bin == "ffmpeg")
    settings["is_cloud"] = IS_CLOUD_DEPLOY
    return settings

@app.post("/api/settings")
def api_save_settings(req: SettingsRequest):
    updates = {k: v for k, v in req.dict().items() if v is not None}
    saved = save_settings(updates)
    return {"success": True, "settings": saved}
