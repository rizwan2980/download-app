# 🚀 OmniDownloader PRO - All-in-One Social Media Downloader & Watermark Remover (Python)

An advanced, high-performance Python application designed to download videos and audio from all major social media platforms with built-in **Watermark Removal** and an interactive **Watermark Removal Studio**.

---

## ✨ Features

- **🔥 All Major Platforms Supported**:
  - **TikTok & Douyin**: 1-Click **No-Watermark** HD video download.
  - **Instagram**: Reels, Stories, Posts, Carousels, IGTV in full original resolution.
  - **YouTube**: 4K, 1440p, 1080p, 720p, 480p MP4 videos & high-bitrate MP3 audio (320kbps).
  - **Facebook**: Public HD/SD videos and Reels.
  - **Twitter / X, Pinterest, Reddit, Threads, Snapchat, LinkedIn, Vimeo, SoundCloud**, and 1000+ websites.

- **✂️ Watermark Removal Studio**:
  - **Source Clean Stream**: Direct watermark-free extraction from TikTok & Instagram CDNs.
  - **Visual Interactive Canvas**: Select watermark area directly on the video player with draggable & resizable bounding box.
  - **FFmpeg Inpaint Delogo & Glass Blur**: Advanced pixel-interpolation and soft-blur filtering to seamlessly erase hardcoded logos, handles, or subtitles from any video.
  - **Corner Presets**: Instant 1-click selection for Top-Right (TikTok), Bottom-Right, Top-Left, Bottom-Left, or Subtitle Bar.

- **⚡ Batch Downloader**:
  - Paste dozens of URLs simultaneously and download them in a multi-threaded queue.

- **📁 Local Media Library & Player**:
  - Built-in video and audio player.
  - Direct "Show in Folder" button (opens in Windows File Explorer).
  - One-click transfer from Library to Watermark Studio.

- **🎨 Modern Glassmorphic Dark UI**:
  - Real-time download speed, ETA, and progress bar animations.
  - Portable Python & FFmpeg environment included.

---

## 🚀 How to Run (1-Click)

Simply double-click the launcher:
```cmd
run.bat
```
The application will automatically start the server and open the web dashboard in your default browser at `http://127.0.0.1:8000`.

---

## 🛠️ Manual Startup (Terminal)

```powershell
.\python_runtime\python.exe main.py
```

---

## 📂 Project Structure

```
download app/
├── backend/
│   ├── app.py                # FastAPI REST API & Static File Server
│   ├── config.py             # Settings, paths & FFmpeg detector
│   ├── downloader.py         # TikWM clean API + yt-dlp download engine
│   ├── watermark_remover.py  # FFmpeg delogo & blur video inpaint processor
│   └── utils.py              # Platform detection, formatting & explorer tools
├── static/
│   ├── index.html            # Ultra-modern Glassmorphic UI
│   ├── css/style.css         # Dark theme styling, glowing micro-animations
│   └── js/app.js             # Canvas bounding box selector, download tracker
├── bin/
│   └── ffmpeg.exe            # High-performance multimedia encoder
├── python_runtime/           # Portable standalone Python 3.11 environment
├── downloads/                # Saved videos and MP3 files
├── run.bat                   # 1-Click launcher
├── requirements.txt          # Python dependencies
└── main.py                   # App startup entry point
```
