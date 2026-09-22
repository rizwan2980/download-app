# 🚀 Production Deployment Guide for Railway (Docker)

This guide walks you through deploying **OmniDownloader PRO** to [Railway.app](https://railway.app) to get a public, shareable HTTPS website URL.

---

## 📋 Prerequisites

1. A free account on [Railway.app](https://railway.app).
2. A free account on [GitHub.com](https://github.com).
3. [Git](https://git-scm.com) installed on your computer.

---

## 🛠️ Step 1: Push Your Code to GitHub

Open a terminal (PowerShell or Command Prompt) in the project folder and run:

```bash
# 1. Initialize git (if not already initialized)
git init

# 2. Add all deployment files
git add .

# 3. Commit your project
git commit -m "Production release for Railway deployment"

# 4. Link to your GitHub repository (replace with your repository URL)
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# 5. Push to GitHub
git push -u origin main
```

*(Note: The included `.gitignore` will automatically prevent temporary videos, caches, and test files from being uploaded.)*

---

## ☁️ Step 2: Deploy on Railway (3 Clicks)

1. Log in to your **[Railway Dashboard](https://railway.app/dashboard)**.
2. Click **"New Project"** (or **"+ New"** button).
3. Select **"Deploy from GitHub repo"**.
4. Choose your repository from the list.
5. Click **"Deploy Now"**.

Railway will automatically detect the **`Dockerfile`**, build the container image with Python 3.11 and **FFmpeg**, and start the FastAPI production server.

---

## 🌐 Step 3: Generate Your Public HTTPS Domain

1. In your Railway project canvas, click on your deployed service box.
2. Go to the **"Settings"** tab.
3. Scroll down to the **"Networking"** section.
4. Click **"Generate Domain"** (or configure a custom domain if you have one).
5. You will get a public URL like:
   ```
   https://omnidownloader-production-xxxx.up.railway.app
   ```

---

## ⚙️ Step 4: Environment Variables (Optional)

Go to the **"Variables"** tab in Railway if you wish to customize any settings:

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `MAX_FILE_AGE_MINUTES` | `60` | Auto-deletes processed video files older than 60 minutes to protect container disk space. |
| `CLEANUP_INTERVAL_MINUTES` | `15` | How often the background retention scan runs. |
| `DEFAULT_AUDIO_BITRATE` | `320` | Default MP3 extraction bitrate (320, 256, 192). |
| `AUTO_REMOVE_WATERMARK` | `true` | Enables automatic watermark-free stream downloads for TikTok & Reels. |
| `LOG_LEVEL` | `INFO` | Server logging verbosity (`DEBUG`, `INFO`, `WARNING`, `ERROR`). |
| `CORS_ORIGINS` | `*` | Allowed CORS origins. |

*(Note: Railway automatically provides `$PORT` to the application, so you do not need to set `PORT` manually.)*

---

## 🔍 Step 5: Verify Your Deployment

1. **Health Check**: Open `https://YOUR_DOMAIN.up.railway.app/health` in your browser. You should see:
   ```json
   {
     "status": "healthy",
     "service": "OmniDownloader PRO",
     "ffmpeg_available": true,
     "is_cloud": true,
     "version": "1.0.0"
   }
   ```
2. **Web Dashboard**: Open `https://YOUR_DOMAIN.up.railway.app` and test:
   - Paste a TikTok / Instagram / YouTube link and click **"Fetch Video"**.
   - Download the video in your preferred resolution.
   - Test the **Watermark Studio** editor.

---

## 💡 Important Production Notes

- **Container Disk Space**: Railway uses ephemeral container storage. The built-in **Auto-Cleanup Daemon** automatically deletes completed/temporary media files after 60 minutes so your container disk never fills up.
- **FFmpeg Integration**: The Docker build automatically installs the official Linux FFmpeg binary (`/usr/bin/ffmpeg`) with full H.264, AAC, and Delogo/Blur support.
- **Zero Localhost Dependencies**: All API endpoints use relative paths (`/api/...`), so they automatically adapt to your live domain with SSL/HTTPS.
