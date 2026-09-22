import os
import sys
import time
import json
import uuid
import re
import subprocess
import threading
import requests
from pathlib import Path
from typing import Dict, Any, Optional, Callable

import yt_dlp

from backend.config import get_ffmpeg_path, load_settings, logger
from backend.utils import detect_platform, sanitize_filename, format_bytes, format_duration

def ensure_h264_compatibility(file_path: Path) -> Path:
    """Ensures the video is universal MP4 with +faststart moov atom at the front
    so it streams immediately in any browser (mobile & desktop) without freezing CPU."""
    if not file_path.exists() or file_path.suffix.lower() not in [".mp4", ".mkv", ".webm", ".mov", ".avi"]:
        return file_path

    ffmpeg_bin = get_ffmpeg_path()
    temp_out = file_path.with_name(f"fast_{file_path.stem}.mp4")

    # 1. Fast stream copy (0.1 second, 0% CPU spike)
    copy_cmd = [
        ffmpeg_bin, "-y",
        "-i", str(file_path),
        "-c", "copy",
        "-movflags", "+faststart",
        str(temp_out)
    ]
    try:
        res = subprocess.run(copy_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=20)
        if res.returncode == 0 and temp_out.exists() and temp_out.stat().st_size > 1000:
            target_mp4 = file_path.with_suffix(".mp4")
            file_path.unlink(missing_ok=True)
            if target_mp4.exists():
                target_mp4.unlink(missing_ok=True)
            temp_out.rename(target_mp4)
            return target_mp4
    except Exception as e:
        logger.debug(f"Fast stream copy notice: {e}")

    # 2. Transcode fallback only if copy fails (e.g. incompatible stream container), throttled to 2 threads
    transcode_cmd = [
        ffmpeg_bin, "-y",
        "-i", str(file_path),
        "-threads", "2",
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-crf", "22",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "192k",
        "-movflags", "+faststart",
        str(temp_out)
    ]
    try:
        res = subprocess.run(transcode_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=120)
        if res.returncode == 0 and temp_out.exists() and temp_out.stat().st_size > 1000:
            target_mp4 = file_path.with_suffix(".mp4")
            file_path.unlink(missing_ok=True)
            if target_mp4.exists():
                target_mp4.unlink(missing_ok=True)
            temp_out.rename(target_mp4)
            return target_mp4
    except Exception as e:
        logger.warning(f"Faststart transcode warning: {e}")
    if temp_out.exists():
        temp_out.unlink(missing_ok=True)
    return file_path

# Global in-memory job registry
JOBS: Dict[str, Dict[str, Any]] = {}
JOBS_LOCK = threading.Lock()

def get_job(job_id: str) -> Optional[Dict[str, Any]]:
    with JOBS_LOCK:
        return JOBS.get(job_id)

def update_job(job_id: str, **kwargs):
    with JOBS_LOCK:
        if job_id in JOBS:
            JOBS[job_id].update(kwargs)

def create_job(url: str, options: dict) -> str:
    job_id = str(uuid.uuid4())[:8]
    with JOBS_LOCK:
        JOBS[job_id] = {
            "id": job_id,
            "url": url,
            "options": options,
            "platform": detect_platform(url),
            "status": "queued",
            "progress": 0.0,
            "speed": "0 KB/s",
            "eta": "--:--",
            "downloaded_bytes": 0,
            "total_bytes": 0,
            "filename": "",
            "filepath": "",
            "title": "",
            "thumbnail": "",
            "error": None,
            "created_at": time.time(),
            "completed_at": None,
            "cancelled": False
        }
    return job_id

def clean_snapchat_video(input_path: Path, output_path: Path, resolution: str = "1080p", progress_callback=None) -> bool:
    """Removes Snapchat bouncing/corner watermarks and optionally upscales to crisp 1080p/4K."""
    try:
        import cv2
        import numpy as np

        ffmpeg_bin = get_ffmpeg_path()
        cap = cv2.VideoCapture(str(input_path))
        if not cap.isOpened():
            return False

        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1
        half_f = max(1, total_frames // 2)

        tl_y1, tl_y2 = int(0.05 * h), int(0.23 * h)
        tl_x1, tl_x2 = int(0.02 * w), int(0.43 * w)
        tl_h = tl_y2 - tl_y1
        tl_w = tl_x2 - tl_x1
        tl_acc = np.zeros((tl_h, tl_w), dtype=np.float32)

        sample_step_tl = max(1, half_f // 25)
        for f_idx in range(0, min(half_f, total_frames), sample_step_tl):
            cap.set(cv2.CAP_PROP_POS_FRAMES, f_idx)
            ret, f = cap.read()
            if not ret: break
            crop = f[tl_y1:tl_y2, tl_x1:tl_x2]
            m = cv2.inRange(crop, (165, 165, 165), (255, 255, 255))
            tl_acc += (m > 0).astype(np.float32)

        tl_mask = (tl_acc > 2).astype(np.uint8) * 255
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        tl_mask = cv2.dilate(tl_mask, kernel, iterations=2)

        br_y1, br_y2 = int(0.78 * h), int(0.97 * h)
        br_x1, br_x2 = int(0.55 * w), int(0.98 * w)
        br_h = br_y2 - br_y1
        br_w = br_x2 - br_x1
        br_acc = np.zeros((br_h, br_w), dtype=np.float32)

        sample_step_br = max(1, (total_frames - half_f) // 25)
        for f_idx in range(half_f, total_frames, sample_step_br):
            cap.set(cv2.CAP_PROP_POS_FRAMES, f_idx)
            ret, f = cap.read()
            if not ret: break
            crop = f[br_y1:br_y2, br_x1:br_x2]
            m = cv2.inRange(crop, (165, 165, 165), (255, 255, 255))
            br_acc += (m > 0).astype(np.float32)

        br_mask = (br_acc > 2).astype(np.uint8) * 255
        br_mask = cv2.dilate(br_mask, kernel, iterations=2)

        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)

        scale_filter = []
        if resolution == "4k":
            out_w, out_h = (3840, 2160) if w >= h else (2160, 3840)
            scale_filter = [f"scale={out_w}:{out_h}:flags=lanczos,unsharp=5:5:0.8:5:5:0.4"]
        elif resolution == "1080p":
            out_w, out_h = (1920, 1080) if w >= h else (1080, 1920)
            scale_filter = [f"scale={out_w}:{out_h}:flags=lanczos,unsharp=5:5:0.7:5:5:0.3"]

        vf_arg = ["-vf", ",".join(scale_filter)] if scale_filter else []

        cmd = [
            ffmpeg_bin, '-y',
            '-f', 'rawvideo',
            '-vcodec', 'rawvideo',
            '-s', f'{w}x{h}',
            '-pix_fmt', 'bgr24',
            '-r', str(fps),
            '-i', '-',
            '-i', str(input_path),
            '-map', '0:v:0',
            '-map', '1:a:0?'
        ] + vf_arg + [
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-crf', '17',
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',
            '-b:a', '192k',
            '-movflags', '+faststart',
            str(output_path)
        ]

        proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=subprocess.PIPE)

        frame_idx = 0
        while True:
            ret, frame = cap.read()
            if not ret: break

            if frame_idx <= half_f:
                crop = frame[tl_y1:tl_y2, tl_x1:tl_x2]
                bright = cv2.inRange(crop, (155, 155, 155), (255, 255, 255))
                m = cv2.bitwise_and(tl_mask, bright)
                m = cv2.dilate(m, kernel, iterations=2)
                if np.any(m):
                    frame[tl_y1:tl_y2, tl_x1:tl_x2] = cv2.inpaint(crop, m, 4, cv2.INPAINT_TELEA)
            else:
                crop = frame[br_y1:br_y2, br_x1:br_x2]
                bright = cv2.inRange(crop, (155, 155, 155), (255, 255, 255))
                m = cv2.bitwise_and(br_mask, bright)
                m = cv2.dilate(m, kernel, iterations=2)
                if np.any(m):
                    frame[br_y1:br_y2, br_x1:br_x2] = cv2.inpaint(crop, m, 4, cv2.INPAINT_TELEA)

            try:
                proc.stdin.write(frame.tobytes())
            except Exception:
                break

            frame_idx += 1
            if progress_callback and frame_idx % 15 == 0:
                pct = 80.0 + (frame_idx / total_frames) * 18.0
                progress_callback(min(round(pct, 1), 98.0))

        cap.release()
        try:
            proc.stdin.close()
        except Exception:
            pass
        proc.wait()
        return output_path.exists() and output_path.stat().st_size > 1000
    except Exception as e:
        logger.warning(f"clean_snapchat_video exception: {e}")
        return False

def extract_tiktok_no_watermark(url: str) -> Optional[Dict[str, Any]]:
    """Fetches direct high-definition no-watermark stream from TikWM API with fallback."""
    try:
        api_url = "https://www.tikwm.com/api/"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
            "Accept": "application/json"
        }
        resp = requests.get(api_url, params={"url": url, "hd": 1}, headers=headers, timeout=15)
        if resp.status_code == 200:
            data = resp.json()
            if data.get("code") == 0 and "data" in data:
                d = data["data"]
                play_url = d.get("hdplay") or d.get("play")
                return {
                    "title": d.get("title") or "TikTok Video",
                    "author": d.get("author", {}).get("nickname") or d.get("author", {}).get("unique_id", "TikTok User"),
                    "thumbnail": d.get("cover") or d.get("origin_cover"),
                    "duration": d.get("duration", 0),
                    "direct_no_wm_url": play_url,
                    "music_url": d.get("music"),
                    "has_watermark_free": True,
                    "platform": "tiktok"
                }
    except Exception as e:
        logger.warning(f"TikWM direct extraction warning: {e}")
    return None

def extract_video_info(url: str) -> Dict[str, Any]:
    """Extracts rich video metadata and available formats for any supported platform."""
    platform_info = detect_platform(url)
    
    # 1. Specialized TikTok No-Watermark resolution
    if platform_info["platform"] == "tiktok":
        tikwm_data = extract_tiktok_no_watermark(url)
        if tikwm_data and tikwm_data.get("direct_no_wm_url"):
            return {
                "success": True,
                "url": url,
                "title": tikwm_data["title"],
                "author": tikwm_data["author"],
                "thumbnail": tikwm_data["thumbnail"],
                "duration": tikwm_data["duration"],
                "duration_formatted": format_duration(tikwm_data["duration"]),
                "platform": platform_info,
                "is_watermark_free_available": True,
                "formats": [
                    {
                        "format_id": "tiktok_nowm_hd",
                        "ext": "mp4",
                        "resolution": "HD No Watermark",
                        "quality_label": "1080p / 720p Clean (No Watermark)",
                        "is_video": True,
                        "is_audio": False,
                        "direct_url": tikwm_data["direct_no_wm_url"]
                    },
                    {
                        "format_id": "tiktok_audio",
                        "ext": "mp3",
                        "resolution": "Audio Only",
                        "quality_label": "MP3 Audio (Original Sound)",
                        "is_video": False,
                        "is_audio": True,
                        "direct_url": tikwm_data.get("music_url")
                    }
                ]
            }

    # 2. Universal yt-dlp Metadata Extraction
    ffmpeg_path = get_ffmpeg_path()
    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "extract_flat": False,
        "ffmpeg_location": ffmpeg_path,
        "nocheckcertificate": True,
        "geo_bypass": True,
        "socket_timeout": 30,
        "extractor_args": {
            "youtube": {
                "player_client": ["android", "web"]
            }
        },
        "http_headers": {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
        }
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
            if not info:
                raise ValueError("Could not extract media metadata.")
                
            title = info.get("title") or "Social Media Video"
            author = info.get("uploader") or info.get("channel") or info.get("creator") or platform_info["name"]
            thumbnail = info.get("thumbnail") or ""
            duration = info.get("duration") or 0
            
            formats = []
            seen_resolutions = set()
            raw_formats = info.get("formats", [])
            
            has_video = False
            for f in reversed(raw_formats):
                height = f.get("height")
                vcodec = f.get("vcodec")
                if height and vcodec != "none":
                    has_video = True
                    res_label = f"{height}p"
                    if res_label not in seen_resolutions:
                        seen_resolutions.add(res_label)
                        formats.append({
                            "format_id": f.get("format_id"),
                            "ext": "mp4",
                            "height": height,
                            "resolution": res_label,
                            "quality_label": f"{res_label} ({f.get('ext', 'mp4').upper()})",
                            "filesize": format_bytes(f.get("filesize") or f.get("filesize_approx", 0)),
                            "is_video": True,
                            "is_audio": False
                        })
            
            formats.sort(key=lambda x: x.get("height", 0), reverse=True)
            
            if not has_video:
                # Direct stream or CDN URL fallback (Dola AI, Sora, direct MP4, etc.)
                is_direct_video = (
                    info.get("ext") in ["mp4", "mkv", "webm", "mov", "avi"] or
                    any(f.get("ext") in ["mp4", "mkv", "webm", "mov", "avi"] for f in raw_formats) or
                    "video" in str(info.get("format", "")).lower() or
                    "mime_type=video" in url or
                    any(url.lower().endswith(ext) for ext in [".mp4", ".mov", ".mkv", ".webm"])
                )
                if is_direct_video or len(formats) == 0:
                    has_video = True
            
            if has_video:
                formats.insert(0, {
                    "format_id": "4k_enhanced_nowm",
                    "ext": "mp4",
                    "resolution": "4K Ultra HD",
                    "quality_label": "4K Ultra HD • AI Clean (No Watermark)",
                    "filesize": "4K Super-Res",
                    "badge": "✨ AI 4K CLEAN",
                    "is_video": True,
                    "is_audio": False
                })
                formats.insert(1, {
                    "format_id": "1080p_clean_nowm",
                    "ext": "mp4",
                    "resolution": "1080p Full HD",
                    "quality_label": "1080p Full HD • No Watermark (Clean)",
                    "filesize": "Full HD",
                    "badge": "🚀 NO WATERMARK",
                    "is_video": True,
                    "is_audio": False
                })
                formats.insert(2, {
                    "format_id": "best_video",
                    "ext": "mp4",
                    "resolution": "Original HD",
                    "quality_label": "Original Video (Fast Download)",
                    "filesize": "Original",
                    "badge": "⚡ FAST",
                    "is_video": True,
                    "is_audio": False
                })
                
            if platform_info["platform"] in ["dola", "luma", "runway", "kling", "sora", "pika", "hailuo", "heygen", "did", "viggle"] and len(title) > 20 and " " not in title:
                title = f"{platform_info['name']} ({title[:10]}...)"
                
            formats.append({
                "format_id": "best_audio",
                "ext": "mp3",
                "resolution": "Audio MP3",
                "quality_label": "High Quality Audio (MP3 320kbps)",
                "filesize": "Audio",
                "is_video": False,
                "is_audio": True
            })
            
            return {
                "success": True,
                "url": url,
                "title": title,
                "author": author,
                "thumbnail": thumbnail,
                "duration": duration,
                "duration_formatted": format_duration(duration),
                "platform": platform_info,
                "is_watermark_free_available": platform_info["platform"] in ["tiktok", "snapchat", "instagram", "douyin", "dola"],
                "formats": formats
            }
    except Exception as e:
        logger.error(f"Metadata extraction error: {e}")
        return {
            "success": False,
            "url": url,
            "error": str(e),
            "platform": platform_info
        }

def download_stream_direct_resumable(url: str, output_path: Path, job_id: str, max_retries: int = 5) -> bool:
    """Downloads a direct stream with chunk resume, range headers, and auto-retry to prevent halfway drops."""
    session = requests.Session()
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Connection": "keep-alive"
    }

    temp_path = output_path.with_suffix(".part")
    downloaded_bytes = 0
    total_bytes = 0

    try:
        head_resp = session.head(url, headers=headers, timeout=15, allow_redirects=True)
        if head_resp.status_code == 200:
            total_bytes = int(head_resp.headers.get("content-length", 0))
    except Exception:
        pass

    for attempt in range(max_retries):
        job = get_job(job_id)
        if job and job.get("cancelled"):
            if temp_path.exists(): temp_path.unlink(missing_ok=True)
            return False

        req_headers = headers.copy()
        if temp_path.exists():
            downloaded_bytes = temp_path.stat().st_size
            if total_bytes > 0 and downloaded_bytes >= total_bytes:
                temp_path.rename(output_path)
                return True
            if downloaded_bytes > 0:
                req_headers["Range"] = f"bytes={downloaded_bytes}-"

        try:
            start_time = time.time()
            with session.get(url, headers=req_headers, stream=True, timeout=25) as r:
                if r.status_code in [200, 206]:
                    if total_bytes == 0:
                        total_bytes = int(r.headers.get("content-length", 0)) + downloaded_bytes

                    mode = "ab" if downloaded_bytes > 0 and r.status_code == 206 else "wb"
                    if mode == "wb":
                        downloaded_bytes = 0

                    with open(temp_path, mode) as f:
                        for chunk in r.iter_content(chunk_size=131072):
                            current_job = get_job(job_id)
                            if current_job and current_job.get("cancelled"):
                                if temp_path.exists(): temp_path.unlink(missing_ok=True)
                                return False

                            if chunk:
                                f.write(chunk)
                                downloaded_bytes += len(chunk)
                                elapsed = max(0.1, time.time() - start_time)
                                speed_bps = downloaded_bytes / elapsed
                                speed_str = f"{format_bytes(speed_bps)}/s"
                                
                                percent = (downloaded_bytes / total_bytes * 100.0) if total_bytes > 0 else 50.0
                                eta_sec = (total_bytes - downloaded_bytes) / speed_bps if speed_bps > 0 and total_bytes > 0 else 0
                                
                                update_job(
                                    job_id,
                                    status="downloading",
                                    progress=min(round(percent, 1), 99.0),
                                    downloaded_bytes=downloaded_bytes,
                                    total_bytes=total_bytes,
                                    speed=speed_str,
                                    eta=format_duration(eta_sec)
                                )

                    if total_bytes == 0 or downloaded_bytes >= total_bytes:
                        if temp_path.exists():
                            temp_path.rename(output_path)
                        return True
        except (requests.RequestException, IOError) as e:
            logger.warning(f"Download stream attempt {attempt+1}/{max_retries} interrupted: {e}")
            time.sleep(1.5)

    if temp_path.exists() and temp_path.stat().st_size > 0:
        temp_path.rename(output_path)
        return True
    return False

def run_download_job(job_id: str):
    """Executes resilient download with stream resume, multi-codec fallback, and yt-dlp retry engine."""
    job = get_job(job_id)
    if not job:
        return
        
    url = job["url"]
    options = job["options"]
    settings = load_settings()
    download_dir = Path(settings.get("download_dir", "downloads"))
    download_dir.mkdir(parents=True, exist_ok=True)
    
    ffmpeg_path = get_ffmpeg_path()
    format_id = options.get("format_id", "best_video")
    is_audio = options.get("is_audio", False)
    remove_watermark_source = options.get("remove_watermark_source", True)
    
    update_job(job_id, status="extracting", progress=5.0)
    
    try:
        platform_info = detect_platform(url)
        
        # 1. Specialized TikTok Direct Download with Automatic Resumable Streaming
        if platform_info["platform"] == "tiktok" and remove_watermark_source:
            tikwm_data = extract_tiktok_no_watermark(url)
            if tikwm_data and tikwm_data.get("direct_no_wm_url"):
                target_url = tikwm_data["music_url"] if is_audio else tikwm_data["direct_no_wm_url"]
                ext = "mp3" if is_audio else "mp4"
                clean_title = sanitize_filename(tikwm_data["title"] or f"tiktok_{job_id}")
                filename = f"{clean_title}_{job_id}.{ext}"
                out_path = download_dir / filename
                
                update_job(
                    job_id,
                    title=tikwm_data["title"],
                    thumbnail=tikwm_data["thumbnail"],
                    filename=filename,
                    filepath=str(out_path)
                )
                
                success = download_stream_direct_resumable(target_url, out_path, job_id)
                if success and out_path.exists() and out_path.stat().st_size > 0:
                    if not is_audio:
                        out_path = ensure_h264_compatibility(out_path)
                    update_job(
                        job_id,
                        status="completed",
                        progress=100.0,
                        filename=out_path.name,
                        filepath=str(out_path.resolve()),
                        completed_at=time.time()
                    )
                    return
                elif get_job(job_id).get("cancelled"):
                    update_job(job_id, status="cancelled")
                    return
                else:
                    logger.warning("Direct TikTok stream dropped, falling back to universal engine...")

        # 2. Universal Resilient yt-dlp Download Engine
        def ytdl_progress_hook(d):
            current_job = get_job(job_id)
            if current_job and current_job.get("cancelled"):
                raise Exception("DOWNLOAD_CANCELLED")
                
            status = d.get("status")
            if status == "downloading":
                total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
                downloaded = d.get("downloaded_bytes", 0)
                speed = d.get("speed") or 0
                eta = d.get("eta") or 0
                
                percent = 0.0
                if total > 0:
                    percent = (downloaded / total) * 100.0
                elif "_percent_str" in d:
                    try:
                        clean_p = re.sub(r'[^\d.]', '', d["_percent_str"])
                        percent = float(clean_p)
                    except Exception:
                        percent = 50.0
                        
                update_job(
                    job_id,
                    status="downloading",
                    progress=min(round(percent, 1), 99.0),
                    downloaded_bytes=downloaded,
                    total_bytes=total,
                    speed=f"{format_bytes(speed)}/s" if speed else "Downloading...",
                    eta=format_duration(eta) if eta else "--:--"
                )
            elif status == "finished":
                update_job(job_id, status="processing", progress=99.0, speed="Finalizing & Merging...", eta="00:00")

        clean_out_template = str(download_dir / f"%(title).90s_{job_id}.%(ext)s")
        
        # High-resiliency options to prevent throttling, network hiccups, and 50% drops
        ydl_opts = {
            "outtmpl": clean_out_template,
            "progress_hooks": [ytdl_progress_hook],
            "quiet": True,
            "no_warnings": True,
            "ffmpeg_location": ffmpeg_path,
            "retries": 15,
            "fragment_retries": 15,
            "skip_unavailable_fragments": True,
            "file_access_retries": 10,
            "extractor_retries": 5,
            "socket_timeout": 30,
            "buffersize": 1024 * 64,
            "http_chunk_size": 10485760,  # 10MB chunking prevents CDN disconnection
            "concurrent_fragment_downloads": 4,
            "nocheckcertificate": True,
            "geo_bypass": True,
            "extractor_args": {
                "youtube": {
                    "player_client": ["android", "web"]
                }
            },
            "http_headers": {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
                "Accept-Language": "en-US,en;q=0.9",
            }
        }
        
        if is_audio:
            ydl_opts["format"] = "bestaudio/best"
            ydl_opts["postprocessors"] = [{
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": settings.get("audio_bitrate", "320"),
            }]
        elif format_id in ["4k_enhanced_nowm", "1080p_clean_nowm", "best_video"] or "video" in format_id:
            ydl_opts["format"] = "bestvideo[height<=1080]+bestaudio/best[height<=1080]/best/0"
            ydl_opts["merge_output_format"] = "mp4"
        elif format_id.isdigit():
            ydl_opts["format"] = f"bestvideo[height<={format_id}]+bestaudio/best[height<={format_id}]/best"
            ydl_opts["merge_output_format"] = "mp4"
        else:
            ydl_opts["format"] = f"{format_id}+bestaudio/best"
            ydl_opts["merge_output_format"] = "mp4"

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            meta = ydl.extract_info(url, download=True)
            title = meta.get("title", f"media_{job_id}")
            thumb = meta.get("thumbnail", "")
            
            # Find the generated file in download_dir matching job_id
            matched_files = list(download_dir.glob(f"*_{job_id}.*"))
            if matched_files:
                final_file = matched_files[0]
                if not is_audio:
                    needs_clean = (format_id in ["4k_enhanced_nowm", "1080p_clean_nowm"] or remove_watermark_source)
                    target_res = "4k" if format_id == "4k_enhanced_nowm" else ("1080p" if format_id == "1080p_clean_nowm" else "none")

                    if needs_clean and platform_info["platform"] == "snapchat":
                        update_job(job_id, status="processing", progress=85.0, speed="✨ AI Removing Watermark & Enhancing Video...")
                        clean_out = download_dir / f"clean_{job_id}.mp4"
                        def on_clean_progress(pct):
                            update_job(job_id, status="processing", progress=pct, speed="✨ AI Inpainting & Enhancing...")
                        
                        if clean_snapchat_video(final_file, clean_out, resolution=target_res, progress_callback=on_clean_progress):
                            final_file.unlink(missing_ok=True)
                            final_file = clean_out

                    update_job(job_id, status="processing", progress=99.0, speed="Finalizing for Mobile & Gallery Playback...")
                    final_file = ensure_h264_compatibility(final_file)
                update_job(
                    job_id,
                    status="completed",
                    progress=100.0,
                    title=title,
                    thumbnail=thumb,
                    filename=final_file.name,
                    filepath=str(final_file.resolve()),
                    completed_at=time.time()
                )
            else:
                update_job(job_id, status="completed", progress=100.0, title=title, thumbnail=thumb, completed_at=time.time())

    except Exception as e:
        err_msg = str(e)
        logger.error(f"Download job {job_id} error: {err_msg}")
        if "DOWNLOAD_CANCELLED" in err_msg:
            update_job(job_id, status="cancelled")
        else:
            update_job(job_id, status="error", error=err_msg)

def start_download_thread(job_id: str):
    """Launches download worker in background thread."""
    t = threading.Thread(target=run_download_job, args=(job_id,), daemon=True)
    t.start()
    return t
