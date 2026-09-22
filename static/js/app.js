// OmniDownloader - Full Frontend Client Application

document.addEventListener('DOMContentLoaded', () => {
    // Utility helpers
    function formatTime(seconds) {
        if (!seconds || isNaN(seconds) || seconds <= 0) return '00:00';
        const s = Math.floor(seconds);
        const m = Math.floor(s / 60);
        const remSec = s % 60;
        return `${m.toString().padStart(2, '0')}:${remSec.toString().padStart(2, '0')}`;
    }

    function formatBytes(bytes, decimals = 1) {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    // App State
    const state = {
        currentTab: 'downloader',
        extractedVideo: null,
        selectedFormatId: 'best_video',
        isAudioOnly: false,
        activeJobs: new Map(),
        watermarkJobs: new Map(),
        studioVideoLoaded: false,
        studioVideoDimensions: { width: 0, height: 0 },
        watermarkStudio: {
            boxes: [], // [{ id, name, x, y, w, h, mode: 'delogo' }]
            activeBoxId: null,
            enhanceMode: 'none',
            isDragging: false,
            isResizing: false,
            activeResizeHandle: null,
            dragStart: { x: 0, y: 0 },
            lastCompletedFilename: null
        },
        promptGen: {
            selectedDuration: '15s',
            selectedVideoFilename: null,
            selectedVideoUrl: null,
            selectedVideoMeta: null,
            activeJobId: null,
            pollTimer: null,
            lastResult: null
        }
    };

    // DOM Elements
    const elements = {
        // Tabs
        tabBtns: document.querySelectorAll('.nav-tab'),
        tabPanels: document.querySelectorAll('.tab-panel'),
        libraryCount: document.getElementById('library-count'),
        headerOpenFolderBtn: document.getElementById('header-open-folder-btn'),

        // Downloader
        videoUrlInput: document.getElementById('video-url-input'),
        btnPaste: document.getElementById('btn-paste'),
        btnFetchInfo: document.getElementById('btn-fetch-info'),
        platformDetectIcon: document.getElementById('platform-detect-icon'),
        fetchLoader: document.getElementById('fetch-loader'),
        videoPreviewCard: document.getElementById('video-preview-card'),
        previewThumbnail: document.getElementById('preview-thumbnail'),
        previewDuration: document.getElementById('preview-duration'),
        previewPlatformTag: document.getElementById('preview-platform-tag'),
        previewTitle: document.getElementById('preview-title'),
        previewAuthor: document.getElementById('preview-author'),
        watermarkFeatureBox: document.getElementById('watermark-feature-box'),
        toggleSourceNowm: document.getElementById('toggle-source-nowm'),
        formatChipsContainer: document.getElementById('format-chips-container'),
        btnStartDownload: document.getElementById('btn-start-download'),
        btnOpenStudioDirect: document.getElementById('btn-open-studio-direct'),
        jobsListContainer: document.getElementById('jobs-list-container'),
        emptyJobsPlaceholder: document.getElementById('empty-jobs-placeholder'),
        btnClearCompletedJobs: document.getElementById('btn-clear-completed-jobs'),

        // AI Video-to-Prompt Generator (Multi-Provider Hub)
        pgenApiBanner: document.getElementById('pgen-api-banner'),
        providerTabBtns: document.querySelectorAll('.provider-tab-btn'),
        paneProviderOpenai: document.getElementById('pane-provider-openai'),
        paneProviderGemini: document.getElementById('pane-provider-gemini'),
        paneProviderLocal: document.getElementById('pane-provider-local'),
        pgenOpenaiKey: document.getElementById('pgen-openai-key'),
        btnSaveOpenaiKey: document.getElementById('btn-save-openai-key'),
        openaiStatusBadge: document.getElementById('openai-status-badge'),
        pgenGeminiKey: document.getElementById('pgen-gemini-key'),
        btnSaveGeminiKey: document.getElementById('btn-save-gemini-key'),
        geminiStatusBadge: document.getElementById('gemini-status-badge'),
        settingOpenaiApiKey: document.getElementById('setting-openai-api-key'),
        settingGeminiApiKey: document.getElementById('setting-gemini-api-key'),
        pgenDropzone: document.getElementById('pgen-dropzone'),
        pgenFileInput: document.getElementById('pgen-file-input'),
        pgenUploadPrompt: document.getElementById('pgen-upload-prompt'),
        pgenPreviewBox: document.getElementById('pgen-preview-box'),
        pgenPreviewVideo: document.getElementById('pgen-preview-video'),
        pgenMetaFilename: document.getElementById('pgen-meta-filename'),
        pgenMetaDuration: document.getElementById('pgen-meta-duration'),
        pgenMetaResolution: document.getElementById('pgen-meta-resolution'),
        pgenMetaAspect: document.getElementById('pgen-meta-aspect'),
        btnPgenChangeVideo: document.getElementById('btn-pgen-change-video'),
        pgenLibrarySelect: document.getElementById('pgen-library-select'),
        durationCards: document.querySelectorAll('.duration-card'),
        btnGenerateAiPrompt: document.getElementById('btn-generate-ai-prompt'),
        pgenProgressBox: document.getElementById('pgen-progress-box'),
        pgenStatusText: document.getElementById('pgen-status-text'),
        pgenPercentText: document.getElementById('pgen-percent-text'),
        pgenProgressFill: document.getElementById('pgen-progress-fill'),
        pgenResultCard: document.getElementById('pgen-result-card'),
        btnCopyMasterPrompt: document.getElementById('btn-copy-master-prompt'),
        btnDownloadPromptTxt: document.getElementById('btn-download-prompt-txt'),
        btnCopyPromptBottom: document.getElementById('btn-copy-prompt-bottom'),
        btnRegeneratePrompt: document.getElementById('btn-regenerate-prompt'),
        promptTabBtns: document.querySelectorAll('.prompt-tab-btn'),
        promptTabContents: document.querySelectorAll('.prompt-tab-content'),
        pgenOutputMasterText: document.getElementById('pgen-output-master-text'),
        pgenOutputTimeline: document.getElementById('pgen-output-timeline'),
        pgenOutputCamera: document.getElementById('pgen-output-camera'),
        pgenOutputStyle: document.getElementById('pgen-output-style'),
        pgenOutputSound: document.getElementById('pgen-output-sound'),
        pgenOutputTags: document.getElementById('pgen-output-tags'),
        pgenEngineTag: document.getElementById('pgen-engine-tag'),

        // Studio
        canvasViewport: document.getElementById('canvas-viewport'),
        studioVideo: document.getElementById('studio-video'),
        studioCanvas: document.getElementById('studio-canvas'),
        watermarkBoxesContainer: document.getElementById('watermark-boxes-container'),
        studioEmptyPrompt: document.getElementById('studio-empty-prompt'),
        fileUploadInput: document.getElementById('file-upload-input'),
        fileUploadInput2: document.getElementById('file-upload-input-2'),
        studioVideoSelect: document.getElementById('studio-video-select'),
        studioControls: document.getElementById('studio-controls'),
        btnStudioPlay: document.getElementById('btn-studio-play'),
        studioSeekbar: document.getElementById('studio-seekbar'),
        studioTime: document.getElementById('studio-time'),
        btnAutoDetectWm: document.getElementById('btn-auto-detect-wm'),
        btnAddWmZone: document.getElementById('btn-add-wm-zone'),
        btnClearAllZones: document.getElementById('btn-clear-all-zones'),
        cardZoneTop: document.getElementById('card-zone-top'),
        cardZoneSide: document.getElementById('card-zone-side'),
        cardZoneBottom: document.getElementById('card-zone-bottom'),
        chkZoneTop: document.getElementById('chk-zone-top'),
        chkZoneSide: document.getElementById('chk-zone-side'),
        chkZoneBottom: document.getElementById('chk-zone-bottom'),
        btnToggleManualMode: document.getElementById('btn-toggle-manual-mode'),
        wmZonesList: document.getElementById('wm-zones-list'),
        emptyZonesNote: document.getElementById('empty-zones-note'),
        wmZoneCounter: document.getElementById('wm-zone-counter'),
        coordX: document.getElementById('coord-x'),
        coordY: document.getElementById('coord-y'),
        coordW: document.getElementById('coord-w'),
        coordH: document.getElementById('coord-h'),
        btnProcessWatermark: document.getElementById('btn-process-watermark'),
        wmProgressCard: document.getElementById('wm-progress-card'),
        wmProgStatusText: document.getElementById('wm-prog-status-text'),
        wmProgPercentText: document.getElementById('wm-prog-percent-text'),
        wmProgressFill: document.getElementById('wm-progress-fill'),
        wmCompletedActions: document.getElementById('wm-completed-actions'),
        btnViewCleanVideo: document.getElementById('btn-view-clean-video'),
        btnDownloadCleanDirect: document.getElementById('btn-download-clean-direct'),
        presetButtons: document.querySelectorAll('.btn-preset'),
        enhanceCards: document.querySelectorAll('.enhance-card'),

        // Batch
        batchUrlsInput: document.getElementById('batch-urls-input'),
        batchToggleNowm: document.getElementById('batch-toggle-nowm'),
        batchFormatSelect: document.getElementById('batch-format-select'),
        btnStartBatch: document.getElementById('btn-start-batch'),
        batchResultsContainer: document.getElementById('batch-results-container'),
        batchJobsList: document.getElementById('batch-jobs-list'),

        // Library
        libraryGridContainer: document.getElementById('library-grid-container'),
        emptyLibraryPlaceholder: document.getElementById('empty-library-placeholder'),
        btnRefreshLibrary: document.getElementById('btn-refresh-library'),
        btnClearMyLibrary: document.getElementById('btn-clear-my-library'),
        btnOpenLibraryFolder: document.getElementById('btn-open-library-folder'),
        libraryStoragePath: document.getElementById('library-storage-path'),

        // Settings
        settingDownloadDir: document.getElementById('setting-download-dir'),
        btnSettingOpenDir: document.getElementById('btn-setting-open-dir'),
        settingAutoNowm: document.getElementById('setting-auto-nowm'),
        settingAudioBitrate: document.getElementById('setting-audio-bitrate'),
        settingGeminiApiKey: document.getElementById('setting-gemini-api-key'),
        settingFfmpegStatus: document.getElementById('setting-ffmpeg-status'),
        btnSaveSettings: document.getElementById('btn-save-settings'),

        // Modal Player
        playerModal: document.getElementById('player-modal'),
        modalVideoTitle: document.getElementById('modal-video-title'),
        modalVideoElement: document.getElementById('modal-video-element'),
        btnClosePlayer: document.getElementById('btn-close-player'),
        modalOpenWmBtn: document.getElementById('modal-open-wm-btn'),
        toastContainer: document.getElementById('toast-container')
    };

    // ==========================================
    // PRIVATE PER-USER LIBRARY STORAGE (LOCALSTORAGE)
    // ==========================================
    const USER_LIB_KEY = 'omni_private_user_library';

    function getPrivateLibrary() {
        try {
            const raw = localStorage.getItem(USER_LIB_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    function savePrivateLibrary(items) {
        try {
            localStorage.setItem(USER_LIB_KEY, JSON.stringify(items));
        } catch (e) {
            console.error('Failed to save to localStorage', e);
        }
    }

    function addPrivateMediaItem(item) {
        if (!item || !item.filename) return;
        const list = getPrivateLibrary();
        const existingIdx = list.findIndex(i => i.filename === item.filename);
        if (existingIdx >= 0) {
            list[existingIdx] = { ...list[existingIdx], ...item };
        } else {
            list.unshift(item);
        }
        if (list.length > 150) list.length = 150;
        savePrivateLibrary(list);
        updateLibraryBadge();
    }

    function removePrivateMediaItem(filename) {
        const list = getPrivateLibrary().filter(i => i.filename !== filename);
        savePrivateLibrary(list);
        updateLibraryBadge();
    }

    function updateLibraryBadge() {
        const list = getPrivateLibrary();
        if (elements.libraryCount) {
            elements.libraryCount.textContent = list.length;
        }
    }

    // Helper: Trigger Direct File Download into Mobile Gallery / PC Downloads
    function triggerBrowserDownload(downloadUrl, filename) {
        if (!downloadUrl) return;
        try {
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = filename || 'downloaded_media.mp4';
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => a.remove(), 300);
        } catch (e) {
            window.open(downloadUrl, '_blank');
        }
    }

    // Helper: Toast Notifications
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icon = type === 'success' ? 'fa-circle-check' : (type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-info');
        toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
        elements.toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    // Helper: Format Duration (MM:SS)
    function formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '00:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // Tab Navigation
    function switchTab(tabId) {
        state.currentTab = tabId;
        elements.tabBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });
        elements.tabPanels.forEach(panel => {
            panel.classList.toggle('active', panel.id === `panel-${tabId}`);
        });

        if (tabId === 'library') {
            loadLibrary();
        } else if (tabId === 'settings') {
            loadSettings();
        } else if (tabId === 'watermark') {
            refreshStudioVideoSelect();
            setTimeout(() => {
                if (state.studioVideoLoaded || (elements.studioVideo && elements.studioVideo.src)) {
                    renderWatermarkBoxes();
                }
            }, 80);
        }
    }

    elements.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // URL Detection Icons
    function updateUrlIcon(url) {
        const iconWrapper = elements.platformDetectIcon;
        if (/tiktok\.com|douyin\.com/i.test(url)) {
            iconWrapper.innerHTML = '<i class="fa-brands fa-tiktok" style="color:#fe2c55;"></i>';
        } else if (/instagram\.com/i.test(url)) {
            iconWrapper.innerHTML = '<i class="fa-brands fa-instagram" style="color:#e1306c;"></i>';
        } else if (/youtube\.com|youtu\.be/i.test(url)) {
            iconWrapper.innerHTML = '<i class="fa-brands fa-youtube" style="color:#ff0000;"></i>';
        } else if (/facebook\.com|fb\.watch/i.test(url)) {
            iconWrapper.innerHTML = '<i class="fa-brands fa-facebook" style="color:#1877f2;"></i>';
        } else if (/twitter\.com|x\.com/i.test(url)) {
            iconWrapper.innerHTML = '<i class="fa-brands fa-x-twitter" style="color:#1da1f2;"></i>';
        } else if (/pinterest\.com|pin\.it/i.test(url)) {
            iconWrapper.innerHTML = '<i class="fa-brands fa-pinterest" style="color:#e60023;"></i>';
        } else if (/reddit\.com/i.test(url)) {
            iconWrapper.innerHTML = '<i class="fa-brands fa-reddit" style="color:#ff4500;"></i>';
        } else {
            iconWrapper.innerHTML = '<i class="fa-solid fa-link" style="color:var(--primary);"></i>';
        }
    }

    elements.videoUrlInput.addEventListener('input', (e) => {
        updateUrlIcon(e.target.value.trim());
    });

    // Paste Button
    elements.btnPaste.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                elements.videoUrlInput.value = text.trim();
                updateUrlIcon(text.trim());
                fetchVideoInfo(text.trim());
            }
        } catch (err) {
            elements.videoUrlInput.focus();
            showToast('Please paste the URL using Ctrl+V', 'info');
        }
    });

    // Fetch Video Info Action
    elements.btnFetchInfo.addEventListener('click', () => {
        const url = elements.videoUrlInput.value.trim();
        if (!url) {
            showToast('Please paste a video URL first', 'error');
            return;
        }
        fetchVideoInfo(url);
    });

    elements.videoUrlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            elements.btnFetchInfo.click();
        }
    });

    async function fetchVideoInfo(url) {
        elements.fetchLoader.style.display = 'flex';
        elements.videoPreviewCard.style.display = 'none';

        try {
            const res = await fetch('/api/extract-info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.detail || data.error || 'Failed to extract video streams');
            }

            state.extractedVideo = data;
            renderVideoPreview(data);
            showToast(`Loaded "${data.title.substring(0, 30)}..."`, 'success');
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            elements.fetchLoader.style.display = 'none';
        }
    }

    const DEFAULT_THUMB_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><rect width="640" height="360" fill="%230f172a"/><circle cx="320" cy="180" r="48" fill="%236366f1" opacity="0.8"/><polygon points="310,160 340,180 310,200" fill="%23ffffff"/><text x="320" y="260" font-family="sans-serif" font-size="16" fill="%2394a3b8" text-anchor="middle">OmniDownloader Video</text></svg>`;

    function renderVideoPreview(data) {
        elements.previewThumbnail.onerror = function() {
            this.onerror = null;
            this.src = DEFAULT_THUMB_SVG;
        };
        elements.previewThumbnail.src = data.thumbnail || DEFAULT_THUMB_SVG;
        elements.previewDuration.textContent = data.duration_formatted || '00:00';
        elements.previewTitle.textContent = data.title;
        elements.previewAuthor.textContent = data.author;

        // Platform Tag
        const p = data.platform;
        elements.previewPlatformTag.innerHTML = `<i class="fa-brands ${p.icon}"></i> <span>${p.name}</span>`;

        // Watermark toggle visibility
        if (data.is_watermark_free_available) {
            elements.watermarkFeatureBox.style.display = 'flex';
            elements.toggleSourceNowm.checked = true;
        } else {
            elements.watermarkFeatureBox.style.display = 'none';
        }

        // Render Format Chips
        elements.formatChipsContainer.innerHTML = '';
        state.selectedFormatId = data.formats[0]?.format_id || 'best_video';
        state.isAudioOnly = data.formats[0]?.is_audio || false;

        data.formats.forEach((fmt, index) => {
            const chip = document.createElement('div');
            chip.className = `format-chip ${index === 0 ? 'active' : ''}`;
            chip.dataset.formatId = fmt.format_id;
            chip.dataset.isAudio = fmt.is_audio;

            const icon = fmt.is_audio ? 'fa-music' : 'fa-film';
            const badgeHtml = fmt.badge ? `<span class="format-badge">${fmt.badge}</span>` : '';
            chip.innerHTML = `
                <div class="format-chip-res">
                    <span><i class="fa-solid ${icon}"></i> ${fmt.resolution}</span>
                    ${badgeHtml}
                    <span>${fmt.ext.toUpperCase()}</span>
                </div>
                <div class="format-chip-size">${fmt.quality_label || fmt.filesize || ''}</div>
            `;

            chip.addEventListener('click', () => {
                document.querySelectorAll('.format-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                state.selectedFormatId = fmt.format_id;
                state.isAudioOnly = fmt.is_audio;
            });

            elements.formatChipsContainer.appendChild(chip);
        });

        elements.videoPreviewCard.style.display = 'block';
    }

    // Start Download
    // Start Download
    elements.btnStartDownload.addEventListener('click', async () => {
        if (!state.extractedVideo) return;

        const originalBtnHtml = elements.btnStartDownload.innerHTML;
        elements.btnStartDownload.disabled = true;
        elements.btnStartDownload.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Starting...</span>';

        const payload = {
            url: state.extractedVideo.url,
            format_id: state.selectedFormatId,
            is_audio: state.isAudioOnly,
            remove_watermark_source: elements.toggleSourceNowm.checked
        };

        try {
            const res = await fetch('/api/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (res.ok && data.job_id) {
                showToast('Download started!', 'success');
                trackDownloadJob(data.job_id, state.extractedVideo.title);
                // Smooth scroll to Active Transfers so user sees live progress
                if (elements.jobsListContainer) {
                    elements.jobsListContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            } else {
                throw new Error(data.detail || 'Download request failed');
            }
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            elements.btnStartDownload.disabled = false;
            elements.btnStartDownload.innerHTML = originalBtnHtml;
        }
    });

    // Open in Studio Direct
    elements.btnOpenStudioDirect.addEventListener('click', () => {
        switchTab('watermark');
    });

    function refreshStudioVideoSelect() {
        const privateItems = getPrivateLibrary();
        const vids = (privateItems || []).filter(i => (i.type || '').toLowerCase() === 'video' || (i.ext || '').match(/(mp4|mov|mkv|webm|avi)/i));
        
        if (elements.studioVideoSelect) {
            const cur = elements.studioVideoSelect.value;
            elements.studioVideoSelect.innerHTML = '<option value="">-- Choose from downloaded videos --</option>';
            vids.forEach(v => {
                const opt = document.createElement('option');
                opt.value = v.filename;
                opt.textContent = v.title || v.filename;
                elements.studioVideoSelect.appendChild(opt);
            });
            if (cur) elements.studioVideoSelect.value = cur;
        }

        if (elements.pgenLibrarySelect) {
            const cur = elements.pgenLibrarySelect.value;
            elements.pgenLibrarySelect.innerHTML = '<option value="">-- Choose from downloaded videos --</option>';
            vids.forEach(v => {
                const opt = document.createElement('option');
                opt.value = v.filename;
                opt.textContent = v.title || v.filename;
                elements.pgenLibrarySelect.appendChild(opt);
            });
            if (cur) elements.pgenLibrarySelect.value = cur;
        }
    }

    // Download Job Tracking & Polling
    function trackDownloadJob(jobId, initialTitle) {
        state.activeJobs.set(jobId, { id: jobId, title: initialTitle, status: 'downloading', progress: 0 });
        renderJobsList();

        const pollInterval = setInterval(async () => {
            try {
                const res = await fetch(`/api/job/${jobId}`);
                if (!res.ok) {
                    clearInterval(pollInterval);
                    return;
                }
                const job = await res.json();
                state.activeJobs.set(jobId, job);
                renderJobsList();

                if (job.status === 'completed') {
                    clearInterval(pollInterval);

                    // Save to user's private library
                    if (job.filename) {
                        const directDownloadUrl = `/api/media/download/${encodeURIComponent(job.filename)}`;
                        addPrivateMediaItem({
                            filename: job.filename,
                            title: job.title || job.filename,
                            thumbnail: job.thumbnail || '',
                            url: `/media/${encodeURIComponent(job.filename)}`,
                            download_url: directDownloadUrl,
                            type: job.options && job.options.is_audio ? 'audio' : 'video',
                            ext: job.filename.split('.').pop() || 'mp4',
                            created_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
                            is_nowm: job.filename.includes('_nowm_') || (job.options && job.options.remove_watermark_source)
                        });

                        showToast(`Download finished: "${job.title || 'Video'}"`, 'success');
                    } else {
                        showToast(`Download finished: "${job.title || 'Video'}"`, 'success');
                    }

                    loadLibrary();
                    refreshStudioVideoSelect();
                } else if (job.status === 'error' || job.status === 'cancelled') {
                    clearInterval(pollInterval);
                    if (job.status === 'error') {
                        showToast(`Error downloading: ${job.error || 'Failed'}`, 'error');
                    }
                }
            } catch (err) {
                console.error(err);
            }
        }, 800);
    }

    function renderJobsList() {
        const jobs = Array.from(state.activeJobs.values()).reverse();
        if (jobs.length === 0) {
            elements.emptyJobsPlaceholder.style.display = 'block';
            elements.jobsListContainer.innerHTML = '';
            return;
        }

        elements.emptyJobsPlaceholder.style.display = 'none';

        // Remove deleted jobs
        const activeIds = new Set(jobs.map(j => j.id));
        elements.jobsListContainer.querySelectorAll('.job-card').forEach(c => {
            if (!activeIds.has(c.dataset.jobId)) c.remove();
        });

        jobs.forEach(job => {
            const statusClass = job.status === 'completed' ? 'completed' : (job.status === 'error' ? 'error' : 'downloading');
            const percent = Math.min(Math.max(job.progress || 0, 0), 100);

            let card = elements.jobsListContainer.querySelector(`[data-job-id="${job.id}"]`);
            if (!card) {
                card = document.createElement('div');
                card.className = 'job-card glass-card';
                card.dataset.jobId = job.id;

                card.innerHTML = `
                    <div class="job-header">
                        <div class="job-title"><i class="fa-solid fa-file-video"></i> <span class="job-title-text">${job.title || job.filename || 'Downloading media...'}</span></div>
                        <div class="job-meta-tags">
                            <span class="badge-status ${statusClass}">${job.status.toUpperCase()}</span>
                            <button class="btn-text btn-cancel-job" style="${job.status === 'downloading' ? '' : 'display:none;'}"><i class="fa-solid fa-xmark"></i> Cancel</button>
                        </div>
                    </div>
                    <div class="progress-track">
                        <div class="progress-fill" style="width: ${percent}%;"></div>
                    </div>
                    <div class="job-footer-stats">
                        <span class="job-stats-text">${job.speed || ''} ${job.eta && job.eta !== '--:--' ? `• ETA: ${job.eta}` : ''}</span>
                        <span class="job-percent-text">${percent}%</span>
                    </div>
                    <div class="job-actions-row" style="${job.status === 'completed' ? 'display:flex;' : 'display:none;'}">
                        <button class="btn-primary btn-play-job"><i class="fa-solid fa-play"></i> Watch Video</button>
                        <button class="btn-secondary btn-open-wm-studio"><i class="fa-solid fa-scissors"></i> Remove Watermark</button>
                    </div>
                `;

                // One-time event listeners
                const cancelBtn = card.querySelector('.btn-cancel-job');
                if (cancelBtn) {
                    cancelBtn.addEventListener('click', () => cancelJob(job.id));
                }

                const playBtn = card.querySelector('.btn-play-job');
                if (playBtn) {
                    playBtn.addEventListener('click', () => {
                        const directUrl = `/media/${encodeURIComponent(job.filename)}`;
                        openVideoModal(directUrl, job.title || job.filename, job.filename);
                    });
                }

                const wmBtn = card.querySelector('.btn-open-wm-studio');
                if (wmBtn) {
                    wmBtn.addEventListener('click', () => {
                        switchTab('watermark');
                        loadVideoIntoStudio(`/media/${encodeURIComponent(job.filename)}`, job.filename);
                    });
                }

                elements.jobsListContainer.appendChild(card);
            } else {
                // In-place reactive updates (zero DOM thrashing, zero freeze)
                const titleEl = card.querySelector('.job-title-text');
                if (titleEl && job.title && titleEl.textContent !== job.title) {
                    titleEl.textContent = job.title;
                }

                const badgeEl = card.querySelector('.badge-status');
                if (badgeEl) {
                    badgeEl.className = `badge-status ${statusClass}`;
                    badgeEl.textContent = job.status.toUpperCase();
                }

                const cancelBtn = card.querySelector('.btn-cancel-job');
                if (cancelBtn) {
                    cancelBtn.style.display = job.status === 'downloading' ? '' : 'none';
                }

                const fillEl = card.querySelector('.progress-fill');
                if (fillEl) {
                    fillEl.style.width = `${percent}%`;
                }

                const statsEl = card.querySelector('.job-stats-text');
                if (statsEl) {
                    statsEl.textContent = `${job.speed || ''} ${job.eta && job.eta !== '--:--' ? `• ETA: ${job.eta}` : ''}`;
                }

                const percentEl = card.querySelector('.job-percent-text');
                if (percentEl) {
                    percentEl.textContent = `${percent}%`;
                }

                const actionsRow = card.querySelector('.job-actions-row');
                if (actionsRow) {
                    actionsRow.style.display = job.status === 'completed' ? 'flex' : 'none';
                }
            }
        });
    }

    async function cancelJob(jobId) {
        try {
            await fetch(`/api/cancel/${jobId}`, { method: 'POST' });
            showToast('Download cancelled', 'info');
        } catch (err) {
            console.error(err);
        }
    }

    elements.btnClearCompletedJobs.addEventListener('click', () => {
        for (const [id, job] of state.activeJobs.entries()) {
            if (job.status === 'completed' || job.status === 'cancelled' || job.status === 'error') {
                state.activeJobs.delete(id);
            }
        }
        renderJobsList();
    });

    // ==========================================
    // MULTI-WATERMARK REMOVER STUDIO & 4K AI
    // ==========================================

    function getVideoContentRect() {
        const video = elements.studioVideo;
        if (!video || !video.videoWidth || !video.videoHeight) return null;

        const container = elements.canvasViewport.getBoundingClientRect();
        const videoRect = video.getBoundingClientRect();

        if (!videoRect.width || !videoRect.height) return null;

        const videoRatio = video.videoWidth / video.videoHeight;
        const elementRatio = videoRect.width / videoRect.height;

        let renderWidth = videoRect.width;
        let renderHeight = videoRect.height;
        let renderLeft = videoRect.left - container.left;
        let renderTop = videoRect.top - container.top;

        if (elementRatio > videoRatio) {
            // Pillarbox: black bars on left and right
            renderWidth = videoRect.height * videoRatio;
            renderLeft += (videoRect.width - renderWidth) / 2;
        } else {
            // Letterbox: black bars on top and bottom
            renderHeight = videoRect.width / videoRatio;
            renderTop += (videoRect.height - renderHeight) / 2;
        }

        return {
            left: renderLeft,
            top: renderTop,
            width: renderWidth,
            height: renderHeight,
            scaleX: renderWidth / video.videoWidth,
            scaleY: renderHeight / video.videoHeight
        };
    }

    function initWatermarkCanvas() {
        const video = elements.studioVideo;
        const containerEl = elements.watermarkBoxesContainer;

        function onVideoReady() {
            state.studioVideoDimensions = { width: video.videoWidth, height: video.videoHeight };
            state.studioVideoLoaded = true;
            elements.studioControls.style.display = 'flex';
            elements.studioEmptyPrompt.style.display = 'none';

            if (state.watermarkStudio.boxes.length === 0) {
                autoScanWatermarksSilently();
            } else {
                setTimeout(renderWatermarkBoxes, 50);
            }
        }

        video.addEventListener('loadedmetadata', onVideoReady);
        video.addEventListener('loadeddata', onVideoReady);
        video.addEventListener('canplay', onVideoReady);
        video.addEventListener('play', () => renderWatermarkBoxes());

        video.addEventListener('timeupdate', () => {
            if (!video.duration) return;
            elements.studioSeekbar.value = (video.currentTime / video.duration) * 100;
            elements.studioTime.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
        });

        elements.btnStudioPlay.addEventListener('click', () => {
            if (video.paused) {
                video.play();
                elements.btnStudioPlay.innerHTML = '<i class="fa-solid fa-pause"></i>';
            } else {
                video.pause();
                elements.btnStudioPlay.innerHTML = '<i class="fa-solid fa-play"></i>';
            }
        });

        elements.studioSeekbar.addEventListener('input', (e) => {
            if (video.duration) {
                video.currentTime = (e.target.value / 100) * video.duration;
            }
        });

        // 1. Direct Click & Drag on Video Canvas to DRAW a new box
        containerEl.addEventListener('mousedown', (e) => {
            if (!state.studioVideoLoaded) return;
            if (e.target.closest('.watermark-bbox')) return; // handled by box mousedown

            const rect = getVideoContentRect();
            if (!rect || !rect.scaleX || !rect.scaleY) return;

            const vidW = video.videoWidth || 1280;
            const vidH = video.videoHeight || 720;

            const startX = Math.max(0, Math.min(vidW, (e.clientX - rect.left) / rect.scaleX));
            const startY = Math.max(0, Math.min(vidH, (e.clientY - rect.top) / rect.scaleY));

            const count = state.watermarkStudio.boxes.length;
            const newBox = {
                id: `zone_${Date.now().toString(36)}`,
                name: `Zone #${count + 1}`,
                x: Math.round(startX),
                y: Math.round(startY),
                w: 10,
                h: 10,
                mode: 'inpaint'
            };

            state.watermarkStudio.boxes.push(newBox);
            state.watermarkStudio.activeBoxId = newBox.id;
            state.watermarkStudio.isDrawingNew = true;
            state.watermarkStudio.drawOrigin = { x: startX, y: startY };

            renderWatermarkBoxes();
            e.preventDefault();
        });

        // 2. Global MouseMove for Dragging, Resizing & Drawing
        window.addEventListener('mousemove', (e) => {
            if (!state.studioVideoLoaded) return;

            const rect = getVideoContentRect();
            if (!rect || !rect.scaleX || !rect.scaleY) return;

            const vidW = video.videoWidth || 1280;
            const vidH = video.videoHeight || 720;

            // CASE A: Drawing a new box live
            if (state.watermarkStudio.isDrawingNew) {
                const activeBox = getActiveWatermarkBox();
                if (!activeBox) return;

                const currX = Math.max(0, Math.min(vidW, (e.clientX - rect.left) / rect.scaleX));
                const currY = Math.max(0, Math.min(vidH, (e.clientY - rect.top) / rect.scaleY));

                const origin = state.watermarkStudio.drawOrigin;
                activeBox.x = Math.round(Math.min(origin.x, currX));
                activeBox.y = Math.round(Math.min(origin.y, currY));
                activeBox.w = Math.round(Math.max(10, Math.abs(currX - origin.x)));
                activeBox.h = Math.round(Math.max(10, Math.abs(currY - origin.y)));

                updateActiveBoxDiv();
                syncActiveBoxToInputs();
                return;
            }

            // CASE B: Dragging or Resizing an existing box
            if (!state.watermarkStudio.isDragging && !state.watermarkStudio.isResizing) return;
            const activeBox = getActiveWatermarkBox();
            if (!activeBox) return;

            const dx = (e.clientX - state.watermarkStudio.dragStart.x) / rect.scaleX;
            const dy = (e.clientY - state.watermarkStudio.dragStart.y) / rect.scaleY;
            state.watermarkStudio.dragStart = { x: e.clientX, y: e.clientY };

            if (state.watermarkStudio.isDragging) {
                let newX = activeBox.x + dx;
                let newY = activeBox.y + dy;

                newX = Math.max(0, Math.min(newX, vidW - activeBox.w));
                newY = Math.max(0, Math.min(newY, vidH - activeBox.h));

                activeBox.x = Math.round(newX);
                activeBox.y = Math.round(newY);
            } else if (state.watermarkStudio.isResizing) {
                const handle = state.watermarkStudio.activeResizeHandle;
                let { x, y, w, h } = activeBox;

                if (handle.includes('e')) w += dx;
                if (handle.includes('s')) h += dy;
                if (handle.includes('w')) { x += dx; w -= dx; }
                if (handle.includes('n')) { y += dy; h -= dy; }

                if (w >= 20) {
                    activeBox.w = Math.round(Math.min(w, vidW - x));
                    activeBox.x = Math.round(Math.max(0, x));
                }
                if (h >= 14) {
                    activeBox.h = Math.round(Math.min(h, vidH - y));
                    activeBox.y = Math.round(Math.max(0, y));
                }
            }

            updateActiveBoxDiv();
            syncActiveBoxToInputs();
        });

        // 3. MouseUp Handlers
        window.addEventListener('mouseup', () => {
            if (state.watermarkStudio.isDrawingNew) {
                const activeBox = getActiveWatermarkBox();
                if (activeBox && (activeBox.w < 20 || activeBox.h < 14)) {
                    // Accidental click, remove tiny box
                    state.watermarkStudio.boxes = state.watermarkStudio.boxes.filter(b => b.id !== activeBox.id);
                    state.watermarkStudio.activeBoxId = state.watermarkStudio.boxes[0]?.id || null;
                }
                state.watermarkStudio.isDrawingNew = false;
                renderWatermarkBoxes();
                return;
            }

            if (state.watermarkStudio.isDragging || state.watermarkStudio.isResizing) {
                state.watermarkStudio.isDragging = false;
                state.watermarkStudio.isResizing = false;
                state.watermarkStudio.activeResizeHandle = null;
                renderWatermarkBoxes();
            }
        });

        // Window resize observer
        window.addEventListener('resize', () => {
            if (state.studioVideoLoaded) {
                renderWatermarkBoxes();
            }
        });

        if (window.ResizeObserver && elements.canvasViewport) {
            new ResizeObserver(() => {
                if (state.studioVideoLoaded) {
                    renderWatermarkBoxes();
                }
            }).observe(elements.canvasViewport);
        }
    }

    async function autoScanWatermarksSilently() {
        const filename = elements.studioVideo.dataset.filename;
        if (!filename) {
            renderWatermarkBoxes();
            return;
        }

        try {
            const res = await fetch('/api/watermark/detect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ video_filename: filename })
            });
            const data = await res.json();
            if (res.ok && data.success && data.boxes && data.boxes.length > 0) {
                state.watermarkStudio.boxes = data.boxes;
                state.watermarkStudio.activeBoxId = data.boxes[0]?.id || null;
                renderWatermarkBoxes();
                showToast(`🤖 AI detected ${data.count} watermark zone${data.count > 1 ? 's' : ''}!`, 'success');
            } else {
                renderWatermarkBoxes();
            }
        } catch (e) {
            renderWatermarkBoxes();
        }
    }

    function getActiveWatermarkBox() {
        const id = state.watermarkStudio.activeBoxId;
        return state.watermarkStudio.boxes.find(b => b.id === id) || state.watermarkStudio.boxes[0] || null;
    }

    function renderWatermarkBoxes() {
        const count = state.watermarkStudio.boxes.length;
        if (elements.wmZoneCounter) {
            elements.wmZoneCounter.textContent = `${count} Active Zone${count === 1 ? '' : 's'}`;
        }
        if (typeof syncZoneToggleCards === 'function') {
            syncZoneToggleCards();
        }

        if (count === 0) {
            if (elements.emptyZonesNote) elements.emptyZonesNote.style.display = 'block';
            if (elements.wmZonesList) {
                elements.wmZonesList.innerHTML = '';
                elements.wmZonesList.appendChild(elements.emptyZonesNote);
            }
            if (elements.watermarkBoxesContainer) elements.watermarkBoxesContainer.innerHTML = '';
            return;
        }

        if (elements.emptyZonesNote) elements.emptyZonesNote.style.display = 'none';
        if (elements.wmZonesList) elements.wmZonesList.innerHTML = '';
        if (elements.watermarkBoxesContainer) elements.watermarkBoxesContainer.innerHTML = '';

        const rect = getVideoContentRect();
        if (!rect) {
            setTimeout(renderWatermarkBoxes, 60);
            return;
        }

        const colorPalette = ['#a855f7', '#06b6d4', '#10b981', '#f59e0b', '#ec4899'];

        state.watermarkStudio.boxes.forEach((box, index) => {
            const isActive = box.id === state.watermarkStudio.activeBoxId || (!state.watermarkStudio.activeBoxId && index === 0);
            if (isActive) state.watermarkStudio.activeBoxId = box.id;

            const colorIndex = index % 5;
            const zoneColor = colorPalette[colorIndex];

            // 1. Render Box on Canvas
            const boxDiv = document.createElement('div');
            boxDiv.className = `watermark-bbox color-${colorIndex} ${isActive ? 'active' : ''}`;
            boxDiv.id = `bbox-${box.id}`;

            const pxLeft = Math.round(rect.left + (box.x * rect.scaleX));
            const pxTop = Math.round(rect.top + (box.y * rect.scaleY));
            const pxWidth = Math.max(24, Math.round(box.w * rect.scaleX));
            const pxHeight = Math.max(16, Math.round(box.h * rect.scaleY));

            boxDiv.style.left = `${pxLeft}px`;
            boxDiv.style.top = `${pxTop}px`;
            boxDiv.style.width = `${pxWidth}px`;
            boxDiv.style.height = `${pxHeight}px`;

            boxDiv.innerHTML = `
                <div class="bbox-tag" style="border-left: 3px solid ${zoneColor};">
                    <span>${box.name || `Zone #${index + 1}`}</span>
                    <span class="bbox-tag-del" data-del-id="${box.id}" title="Remove zone"><i class="fa-solid fa-xmark"></i></span>
                </div>
                ${isActive ? `
                <div class="bbox-handle nw" data-handle="nw"></div>
                <div class="bbox-handle ne" data-handle="ne"></div>
                <div class="bbox-handle sw" data-handle="sw"></div>
                <div class="bbox-handle se" data-handle="se"></div>
                ` : ''}
            `;

            // Mouse events for moving & resizing box
            boxDiv.addEventListener('mousedown', (e) => {
                const delBtn = e.target.closest('.bbox-tag-del');
                if (delBtn) {
                    e.stopPropagation();
                    deleteWatermarkZone(box.id);
                    return;
                }

                state.watermarkStudio.activeBoxId = box.id;
                if (e.target.classList.contains('bbox-handle')) {
                    state.watermarkStudio.isResizing = true;
                    state.watermarkStudio.activeResizeHandle = e.target.dataset.handle;
                } else {
                    state.watermarkStudio.isDragging = true;
                }
                state.watermarkStudio.dragStart = { x: e.clientX, y: e.clientY };
                renderWatermarkBoxes();
                e.preventDefault();
                e.stopPropagation();
            });

            elements.watermarkBoxesContainer.appendChild(boxDiv);

            // 2. Render Zone Item in Sidebar List
            const zoneCard = document.createElement('div');
            zoneCard.className = `zone-card-item ${isActive ? 'active' : ''}`;
            zoneCard.innerHTML = `
                <div class="zone-info-left">
                    <span class="zone-color-dot" style="background: ${zoneColor}; box-shadow: 0 0 8px ${zoneColor};"></span>
                    <div>
                        <div class="zone-name">${box.name || `Zone #${index + 1}`}</div>
                        <div class="zone-coords-tag">${box.w}×${box.h} at (${box.x}, ${box.y})</div>
                    </div>
                </div>
                <button type="button" class="btn-text btn-danger-hover btn-del-zone" data-id="${box.id}" title="Delete Zone">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            `;

            zoneCard.addEventListener('click', (e) => {
                if (e.target.closest('.btn-del-zone')) {
                    deleteWatermarkZone(box.id);
                    return;
                }
                state.watermarkStudio.activeBoxId = box.id;
                renderWatermarkBoxes();
            });

            elements.wmZonesList.appendChild(zoneCard);
        });

        syncActiveBoxToInputs();
    }

    function updateActiveBoxDiv() {
        const activeBox = getActiveWatermarkBox();
        if (!activeBox) return;

        const rect = getVideoContentRect();
        if (!rect) return;

        const boxDiv = document.getElementById(`bbox-${activeBox.id}`);
        if (boxDiv) {
            const pxLeft = Math.round(rect.left + (activeBox.x * rect.scaleX));
            const pxTop = Math.round(rect.top + (activeBox.y * rect.scaleY));
            const pxWidth = Math.max(24, Math.round(activeBox.w * rect.scaleX));
            const pxHeight = Math.max(16, Math.round(activeBox.h * rect.scaleY));

            boxDiv.style.left = `${pxLeft}px`;
            boxDiv.style.top = `${pxTop}px`;
            boxDiv.style.width = `${pxWidth}px`;
            boxDiv.style.height = `${pxHeight}px`;
        }
    }

    function syncActiveBoxToInputs() {
        const activeBox = getActiveWatermarkBox();
        if (!activeBox) return;

        elements.coordX.value = activeBox.x;
        elements.coordY.value = activeBox.y;
        elements.coordW.value = activeBox.w;
        elements.coordH.value = activeBox.h;
    }

    function syncInputsToActiveBox() {
        const activeBox = getActiveWatermarkBox();
        if (!activeBox) return;

        activeBox.x = parseInt(elements.coordX.value) || 0;
        activeBox.y = parseInt(elements.coordY.value) || 0;
        activeBox.w = parseInt(elements.coordW.value) || 100;
        activeBox.h = parseInt(elements.coordH.value) || 100;

        updateActiveBoxDiv();
    }

    [elements.coordX, elements.coordY, elements.coordW, elements.coordH].forEach(input => {
        input.addEventListener('input', syncInputsToActiveBox);
    });

    function deleteWatermarkZone(id) {
        state.watermarkStudio.boxes = state.watermarkStudio.boxes.filter(b => b.id !== id);
        if (state.watermarkStudio.activeBoxId === id) {
            state.watermarkStudio.activeBoxId = state.watermarkStudio.boxes[0]?.id || null;
        }
        renderWatermarkBoxes();
    }

    // AI Auto-Scan Watermarks Handler
    if (elements.btnAutoDetectWm) {
        elements.btnAutoDetectWm.addEventListener('click', async () => {
            const filename = elements.studioVideo.dataset.filename;
            if (!filename) {
                showToast('Please load or upload a video first to run AI Scan', 'error');
                return;
            }

            elements.btnAutoDetectWm.disabled = true;
            elements.btnAutoDetectWm.innerHTML = '<div class="spinner-sm"></div> <span>AI Scanning Video...</span>';
            showToast('AI Scanning video keyframes for watermarks...', 'info');

            try {
                const res = await fetch('/api/watermark/detect', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ video_filename: filename })
                });
                const data = await res.json();

                if (res.ok && data.success && data.boxes) {
                    if (data.boxes.length > 0) {
                        state.watermarkStudio.boxes = data.boxes;
                        state.watermarkStudio.activeBoxId = data.boxes[0]?.id || null;
                        renderWatermarkBoxes();
                        showToast(`🤖 AI detected ${data.count} watermark zone${data.count > 1 ? 's' : ''}!`, 'success');
                    } else {
                        showToast('No prominent watermarks detected in video!', 'info');
                    }
                } else {
                    throw new Error(data.detail || 'Could not detect watermarks automatically');
                }
            } catch (err) {
                showToast(err.message, 'error');
            } finally {
                elements.btnAutoDetectWm.disabled = false;
                elements.btnAutoDetectWm.innerHTML = '<i class="fa-solid fa-robot"></i> <span>AI Auto-Scan Watermarks</span>';
            }
        });
    }

    // ==========================================
    // 3 FIXED REMOVAL ZONES (TOP, SIDE, BOTTOM) & MANUAL MODE
    // ==========================================
    function getZonePresetBox(zoneType) {
        const vw = state.studioVideoDimensions.width || 1280;
        const vh = state.studioVideoDimensions.height || 720;
        if (zoneType === 'top') {
            return {
                id: `fixed_zone_top`,
                name: 'Top Zone (Logos/Badges)',
                zoneType: 'top',
                x: Math.round(vw * 0.38),
                y: Math.round(vh * 0.01),
                w: Math.round(vw * 0.60),
                h: Math.round(vh * 0.12),
                mode: 'inpaint'
            };
        } else if (zoneType === 'side') {
            return {
                id: `fixed_zone_side`,
                name: 'Side / Middle Zone',
                zoneType: 'side',
                x: Math.round(vw * 0.02),
                y: Math.round(vh * 0.44),
                w: Math.round(vw * 0.58),
                h: Math.round(vh * 0.12),
                mode: 'inpaint'
            };
        } else if (zoneType === 'bottom') {
            return {
                id: `fixed_zone_bottom`,
                name: 'Bottom Zone (Subtitles/Logos)',
                zoneType: 'bottom',
                x: Math.round(vw * 0.38),
                y: Math.round(vh * 0.86),
                w: Math.round(vw * 0.60),
                h: Math.round(vh * 0.13),
                mode: 'inpaint'
            };
        }
        return null;
    }

    function toggleFixedZone(zoneType, forceState = null) {
        const vh = state.studioVideoDimensions.height || 720;
        const existingIdx = state.watermarkStudio.boxes.findIndex(b => {
            if (b.zoneType === zoneType || b.id === `fixed_zone_${zoneType}`) return true;
            if (zoneType === 'top' && b.y < vh * 0.28) return true;
            if (zoneType === 'side' && b.y >= vh * 0.28 && b.y <= vh * 0.72) return true;
            if (zoneType === 'bottom' && b.y > vh * 0.72) return true;
            return false;
        });

        const shouldAdd = forceState !== null ? forceState : (existingIdx === -1);

        if (shouldAdd) {
            if (existingIdx === -1) {
                const newBox = getZonePresetBox(zoneType);
                if (newBox) {
                    state.watermarkStudio.boxes.push(newBox);
                    state.watermarkStudio.activeBoxId = newBox.id;
                    showToast(`✅ Added ${newBox.name}`, 'info');
                }
            }
        } else {
            if (existingIdx !== -1) {
                state.watermarkStudio.boxes.splice(existingIdx, 1);
                state.watermarkStudio.activeBoxId = state.watermarkStudio.boxes[0]?.id || null;
                showToast(`Removed ${zoneType.toUpperCase()} zone`, 'info');
            }
        }
        renderWatermarkBoxes();
    }

    function syncZoneToggleCards() {
        const vh = state.studioVideoDimensions.height || 720;
        const topActive = state.watermarkStudio.boxes.some(b => b.zoneType === 'top' || b.id === 'fixed_zone_top' || (b.y < vh * 0.28));
        const sideActive = state.watermarkStudio.boxes.some(b => b.zoneType === 'side' || b.id === 'fixed_zone_side' || (b.y >= vh * 0.28 && b.y <= vh * 0.72));
        const bottomActive = state.watermarkStudio.boxes.some(b => b.zoneType === 'bottom' || b.id === 'fixed_zone_bottom' || (b.y > vh * 0.72));

        if (elements.cardZoneTop && elements.chkZoneTop) {
            elements.cardZoneTop.classList.toggle('active', topActive);
            elements.chkZoneTop.checked = topActive;
        }

        if (elements.cardZoneSide && elements.chkZoneSide) {
            elements.cardZoneSide.classList.toggle('active', sideActive);
            elements.chkZoneSide.checked = sideActive;
        }

        if (elements.cardZoneBottom && elements.chkZoneBottom) {
            elements.cardZoneBottom.classList.toggle('active', bottomActive);
            elements.chkZoneBottom.checked = bottomActive;
        }

        if (elements.btnProcessWatermark) {
            const hasZones = state.watermarkStudio.boxes.length > 0;
            elements.btnProcessWatermark.disabled = !hasZones;
        }
    }

    // Connect Click Events for 3 Fixed Zone Toggle Cards
    if (elements.cardZoneTop) {
        elements.cardZoneTop.addEventListener('click', (e) => {
            e.preventDefault();
            toggleFixedZone('top');
        });
    }

    if (elements.cardZoneSide) {
        elements.cardZoneSide.addEventListener('click', (e) => {
            e.preventDefault();
            toggleFixedZone('side');
        });
    }

    if (elements.cardZoneBottom) {
        elements.cardZoneBottom.addEventListener('click', (e) => {
            e.preventDefault();
            toggleFixedZone('bottom');
        });
    }

    // Manual Selection Mode Toggle Button
    let isManualModeActive = false;
    if (elements.btnToggleManualMode) {
        elements.btnToggleManualMode.addEventListener('click', () => {
            isManualModeActive = !isManualModeActive;
            elements.btnToggleManualMode.classList.toggle('active', isManualModeActive);
            
            let banner = document.getElementById('manual-draw-banner');
            if (isManualModeActive) {
                if (!banner && elements.studioVideoWrapper) {
                    banner = document.createElement('div');
                    banner.id = 'manual-draw-banner';
                    banner.className = 'manual-draw-banner';
                    banner.innerHTML = '<i class="fa-solid fa-crosshairs"></i> Manual Draw Active: Click & drag on video to mark areas';
                    elements.studioVideoWrapper.appendChild(banner);
                }
                showToast('✏️ Manual Drawing Active! Click and drag on video to draw custom boxes.', 'info');
            } else {
                if (banner) banner.remove();
                showToast('Manual Drawing Mode closed.', 'info');
            }
        });
    }

    // Add Custom Watermark Box (+)
    if (elements.btnAddWmZone) {
        elements.btnAddWmZone.addEventListener('click', () => {
            const vw = state.studioVideoDimensions.width || 1280;
            const vh = state.studioVideoDimensions.height || 720;
            const count = state.watermarkStudio.boxes.length;

            const defaultPositions = [
                { x: Math.round(vw * 0.70), y: Math.round(vh * 0.80), name: 'Bottom-Right Area' },
                { x: Math.round(vw * 0.70), y: Math.round(vh * 0.04), name: 'Top-Right Area' },
                { x: Math.round(vw * 0.35), y: Math.round(vh * 0.42), name: 'Center / Side Area' },
                { x: Math.round(vw * 0.04), y: Math.round(vh * 0.04), name: 'Top-Left Area' },
                { x: Math.round(vw * 0.04), y: Math.round(vh * 0.80), name: 'Bottom-Left Area' }
            ];

            const pos = defaultPositions[count % defaultPositions.length];
            const newBox = {
                id: `zone_${Date.now().toString(36)}`,
                name: `Custom Box #${count + 1} (${pos.name})`,
                x: pos.x,
                y: pos.y,
                w: Math.round(vw * 0.25),
                h: Math.round(vh * 0.12),
                mode: 'inpaint'
            };

            state.watermarkStudio.boxes.push(newBox);
            state.watermarkStudio.activeBoxId = newBox.id;
            renderWatermarkBoxes();
            showToast(`Added ${newBox.name}. Drag anywhere on video!`, 'info');
        });
    }

    // Clear All Zones Handler
    if (elements.btnClearAllZones) {
        elements.btnClearAllZones.addEventListener('click', () => {
            state.watermarkStudio.boxes = [];
            state.watermarkStudio.activeBoxId = null;
            renderWatermarkBoxes();
            showToast('All watermark zones cleared', 'info');
        });
    }

    // Universal 1-Click Presets Handlers
    function applyCornerPreset(preset) {
        const vw = state.studioVideoDimensions.width || 1080;
        const vh = state.studioVideoDimensions.height || 1920;

        if (preset === 'dola-ai') {
            state.watermarkStudio.boxes = [
                getZonePresetBox('side'),
                getZonePresetBox('bottom'),
                getZonePresetBox('top')
            ];
            state.watermarkStudio.activeBoxId = state.watermarkStudio.boxes[0].id;
            renderWatermarkBoxes();
            showToast('Applied ✨ Dola AI 3-Jumping Logos (Center + Bottom + Top)!', 'success');
            return;
        }

        if (preset === 'all-3-zones' || preset === '3-zones') {
            // Activate Top, Side, and Bottom all together
            state.watermarkStudio.boxes = [
                getZonePresetBox('top'),
                getZonePresetBox('side'),
                getZonePresetBox('bottom')
            ];
            state.watermarkStudio.activeBoxId = state.watermarkStudio.boxes[0].id;
            renderWatermarkBoxes();
            showToast('Applied ✨ All 3 Zones (Top + Side + Bottom)!', 'success');
            return;
        }

        if (preset === 'tiktok-both') {
            state.watermarkStudio.boxes = [
                getZonePresetBox('top'),
                getZonePresetBox('bottom')
            ];
            state.watermarkStudio.activeBoxId = state.watermarkStudio.boxes[0].id;
            renderWatermarkBoxes();
            showToast('Applied TikTok (Top + Bottom) Preset!', 'success');
            return;
        }

        if (preset === 'top-only') {
            state.watermarkStudio.boxes = [getZonePresetBox('top')];
            state.watermarkStudio.activeBoxId = state.watermarkStudio.boxes[0].id;
            renderWatermarkBoxes();
            showToast('Applied Top Only Preset!', 'success');
            return;
        }

        if (preset === 'bottom-only') {
            state.watermarkStudio.boxes = [getZonePresetBox('bottom')];
            state.watermarkStudio.activeBoxId = state.watermarkStudio.boxes[0].id;
            renderWatermarkBoxes();
            showToast('Applied Bottom Only Preset!', 'success');
            return;
        }

        if (preset === 'center') {
            state.watermarkStudio.boxes = [getZonePresetBox('side')];
            state.watermarkStudio.activeBoxId = state.watermarkStudio.boxes[0].id;
            renderWatermarkBoxes();
            showToast('Applied Center / Side Logo Preset!', 'success');
            return;
        }

        renderWatermarkBoxes();
    }

    elements.presetButtons.forEach(btn => {
        btn.addEventListener('click', () => applyCornerPreset(btn.dataset.preset));
    });

    // 4K & Quality Enhancement Selector Cards
    elements.enhanceCards.forEach(card => {
        card.addEventListener('click', () => {
            elements.enhanceCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            const radio = card.querySelector('input');
            if (radio) {
                radio.checked = true;
                state.watermarkStudio.enhanceMode = radio.value;
            }
        });
    });

    // Play Overlay Button Control
    const studioPlayOverlay = document.getElementById('studio-play-overlay');
    if (studioPlayOverlay && elements.studioVideo) {
        studioPlayOverlay.addEventListener('click', () => {
            const video = elements.studioVideo;
            if (video.paused) {
                video.play().then(() => {
                    studioPlayOverlay.style.display = 'none';
                    if (elements.btnStudioPlay) elements.btnStudioPlay.innerHTML = '<i class="fa-solid fa-pause"></i>';
                }).catch(err => {
                    console.error('Play error:', err);
                });
            } else {
                video.pause();
                studioPlayOverlay.style.display = 'flex';
                if (elements.btnStudioPlay) elements.btnStudioPlay.innerHTML = '<i class="fa-solid fa-play"></i>';
            }
        });

        elements.studioVideo.addEventListener('play', () => {
            if (studioPlayOverlay) studioPlayOverlay.style.display = 'none';
            if (elements.btnStudioPlay) elements.btnStudioPlay.innerHTML = '<i class="fa-solid fa-pause"></i>';
        });

        elements.studioVideo.addEventListener('pause', () => {
            if (studioPlayOverlay) studioPlayOverlay.style.display = 'flex';
            if (elements.btnStudioPlay) elements.btnStudioPlay.innerHTML = '<i class="fa-solid fa-play"></i>';
        });
    }

    // Load Video Into Studio (Instant visible preview + auto-painted frame)
    function loadVideoIntoStudio(videoUrl, filename) {
        if (!elements.studioVideo) return;
        
        if (elements.studioEmptyPrompt) elements.studioEmptyPrompt.style.display = 'none';
        if (elements.studioControls) elements.studioControls.style.display = 'flex';
        if (studioPlayOverlay) studioPlayOverlay.style.display = 'flex';
        
        elements.studioVideo.style.display = 'block';
        elements.studioVideo.src = videoUrl;
        elements.studioVideo.dataset.filename = filename;
        elements.studioVideo.muted = true;
        
        try {
            elements.studioVideo.load();
        } catch (e) {
            console.error('Video load error:', e);
        }

        const triggerSetup = () => {
            state.studioVideoLoaded = true;
            state.studioVideoDimensions = {
                width: elements.studioVideo.videoWidth || 1080,
                height: elements.studioVideo.videoHeight || 1920
            };
            if (elements.studioTime && elements.studioVideo.duration) {
                elements.studioTime.textContent = `00:00 / ${formatTime(elements.studioVideo.duration)}`;
            }
            if (state.watermarkStudio.boxes.length === 0) {
                applyCornerPreset('all-3-zones');
            } else {
                renderWatermarkBoxes();
            }
            // Ensure first frame paints visually
            try {
                if (elements.studioVideo.currentTime === 0) {
                    elements.studioVideo.currentTime = 0.05;
                }
            } catch (e) {}
        };

        elements.studioVideo.onloadedmetadata = triggerSetup;
        elements.studioVideo.onloadeddata = triggerSetup;
        elements.studioVideo.oncanplay = triggerSetup;

        // Fallback timeouts to ensure studio is active even if video is paused
        setTimeout(triggerSetup, 80);
        setTimeout(triggerSetup, 300);

        // Ensure option exists in select
        if (elements.studioVideoSelect) {
            let exists = Array.from(elements.studioVideoSelect.options).some(opt => opt.value === filename);
            if (!exists) {
                const opt = document.createElement('option');
                opt.value = filename;
                opt.textContent = `📁 ${filename}`;
                elements.studioVideoSelect.appendChild(opt);
            }
            elements.studioVideoSelect.value = filename;
        }
    }

    async function refreshStudioVideoSelect() {
        if (!elements.studioVideoSelect) return;
        try {
            const res = await fetch('/api/library');
            let items = [];
            if (res.ok) {
                const data = await res.json();
                items = (data.items || []).filter(i => i.type === 'video' || (i.ext && i.ext.match(/(mp4|mov|mkv|webm|avi)/i)));
            }
            if (items.length === 0) {
                items = getPrivateLibrary().filter(item => item.type === 'video' || (item.ext && item.ext.match(/(mp4|mov|mkv|webm|avi)/i)));
            }
            elements.studioVideoSelect.innerHTML = '<option value="">-- Choose from your downloaded videos --</option>';
            items.forEach(v => {
                const opt = document.createElement('option');
                opt.value = v.filename;
                opt.textContent = `${v.title || v.filename} (${v.size || (v.ext || '').toUpperCase()})`;
                elements.studioVideoSelect.appendChild(opt);
            });
        } catch (e) {
            console.error('Error refreshing video select:', e);
        }
    }

    elements.studioVideoSelect.addEventListener('change', (e) => {
        const filename = e.target.value;
        if (filename) {
            loadVideoIntoStudio(`/media/${encodeURIComponent(filename)}`, filename);
        }
    });

    // Connect "Open in Watermark Studio" direct button on Preview Card
    if (elements.btnOpenStudioDirect) {
        elements.btnOpenStudioDirect.addEventListener('click', async () => {
            if (!state.extractedVideo) return;
            showToast('Preparing video for Watermark Studio...', 'info');
            
            const jobs = Array.from(state.activeJobs.values());
            const matched = jobs.find(j => j.url === state.extractedVideo.url && j.status === 'completed');
            if (matched && matched.filename) {
                switchTab('watermark');
                loadVideoIntoStudio(`/media/${encodeURIComponent(matched.filename)}`, matched.filename);
                return;
            }

            try {
                const payload = {
                    url: state.extractedVideo.url,
                    format_id: state.selectedFormatId || 'best_video',
                    is_audio: false,
                    remove_watermark_source: false
                };
                const res = await fetch('/api/download', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (data.job_id) {
                    showToast('⏳ Downloading video to studio...', 'info');
                    const checkInterval = setInterval(async () => {
                        const jres = await fetch(`/api/job/${data.job_id}`);
                        if (jres.ok) {
                            const jdata = await jres.json();
                            if (jdata.status === 'completed' && jdata.filename) {
                                clearInterval(checkInterval);
                                switchTab('watermark');
                                loadVideoIntoStudio(`/media/${encodeURIComponent(jdata.filename)}`, jdata.filename);
                                showToast('🎬 Video loaded in Studio! Select zones and click Remove Watermark.', 'success');
                            } else if (jdata.status === 'error') {
                                clearInterval(checkInterval);
                                showToast(`Error: ${jdata.error}`, 'error');
                            }
                        }
                    }, 500);
                }
            } catch (e) {
                showToast('Could not start download for studio', 'error');
            }
        });
    }

    // Local Video File Upload with Instant Visible Preview & Reliable Streaming
    async function handleVideoFileUpload(file) {
        if (!file) return;
        
        showToast(`📁 Loading ${file.name}...`, 'info');

        // 1. Instant local preview
        try {
            const localBlobUrl = URL.createObjectURL(file);
            loadVideoIntoStudio(localBlobUrl, file.name);
        } catch (e) {
            console.error('Blob URL creation error:', e);
        }

        // 2. Background server upload
        const formData = new FormData();
        formData.append('file', file);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/watermark/upload', true);

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const data = JSON.parse(xhr.responseText);
                    if (data.success && data.filename) {
                        elements.studioVideo.dataset.filename = data.filename;
                        elements.studioVideo.dataset.serverUrl = data.url;
                        addPrivateMediaItem({
                            filename: data.filename,
                            title: file.name,
                            type: 'video',
                            ext: 'mp4',
                            url: data.url,
                            download_url: `/api/media/download/${encodeURIComponent(data.filename)}`,
                            created_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
                        });
                        refreshStudioVideoSelect();
                        if (elements.studioVideoSelect) {
                            elements.studioVideoSelect.value = data.filename;
                        }
                        showToast('✅ Video ready for watermark removal!', 'success');
                    }
                } catch (err) {
                    console.error('Upload response parse error:', err);
                }
            }
        };

        xhr.onerror = () => {
            console.error('XHR upload error');
        };

        xhr.send(formData);
    }

    // Native File Input change events (Desktop + Mobile touch)
    const heroUploadBtn = document.getElementById('btn-upload-hero');
    const heroUploadInput = document.getElementById('file-upload-input');
    const sideUploadBtn = document.getElementById('btn-upload-trigger-2');
    const sideUploadInput = document.getElementById('file-upload-input-2');

    const emptyPrompt = document.getElementById('studio-empty-prompt');
    if (emptyPrompt && heroUploadInput) {
        emptyPrompt.style.cursor = 'pointer';
        emptyPrompt.addEventListener('click', (e) => {
            if (e.target.tagName !== 'LABEL' && e.target.tagName !== 'INPUT' && !e.target.closest('label')) {
                heroUploadInput.click();
            }
        });
    }

    if (sideUploadBtn && sideUploadInput) {
        sideUploadBtn.addEventListener('click', () => {
            sideUploadInput.click();
        });
    }

    [heroUploadInput, sideUploadInput].forEach(input => {
        if (!input) return;
        input.addEventListener('change', async (e) => {
            const file = e.target.files && e.target.files[0];
            if (file) {
                await handleVideoFileUpload(file);
                input.value = '';
            }
        });
    });

    // Drag and drop video support on studio canvas
    const dragTargets = [elements.canvasViewport, document.querySelector('.studio-workspace')];
    dragTargets.forEach(target => {
        if (!target) return;
        target.addEventListener('dragover', (e) => {
            e.preventDefault();
            target.classList.add('drag-over');
        });

        target.addEventListener('dragleave', (e) => {
            e.preventDefault();
            target.classList.remove('drag-over');
        });

        target.addEventListener('drop', async (e) => {
            e.preventDefault();
            target.classList.remove('drag-over');
            const file = e.dataTransfer?.files?.[0];
            if (file) {
                await handleVideoFileUpload(file);
            }
        });
    });

    // Process Watermark Removal & 4K Export Action
    elements.btnProcessWatermark.addEventListener('click', async () => {
        const filename = elements.studioVideo.dataset.filename;
        if (!filename) {
            showToast('Please select or upload a video first', 'error');
            return;
        }

        // Require at least one active removal zone or manual selection
        if (state.watermarkStudio.boxes.length === 0) {
            showToast('⚠️ Please select Top, Side, or Bottom zone above, or draw a manual area on the video!', 'error');
            return;
        }

        const enhanceMode = state.watermarkStudio.enhanceMode || 'none';

        const payload = {
            video_filename: filename,
            boxes: state.watermarkStudio.boxes,
            enhance_mode: enhanceMode
        };

        elements.wmProgressCard.style.display = 'flex';
        elements.wmCompletedActions.style.display = 'none';
        const enhLabel = enhanceMode.includes('4k') ? ' & 4K Enhancing' : '';
        elements.wmProgStatusText.textContent = `Removing Watermarks${enhLabel}...`;
        elements.wmProgPercentText.textContent = '0%';
        elements.wmProgressFill.style.width = '0%';
        elements.btnProcessWatermark.disabled = true;

        try {
            const res = await fetch('/api/watermark/remove', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (res.ok && data.job_id) {
                trackWatermarkJob(data.job_id);
            } else {
                throw new Error(data.detail || 'Watermark removal request failed');
            }
        } catch (err) {
            elements.btnProcessWatermark.disabled = false;
            showToast(err.message, 'error');
        }
    });

    function trackWatermarkJob(jobId) {
        const poll = setInterval(async () => {
            try {
                const res = await fetch(`/api/watermark/job/${jobId}`);
                if (!res.ok) {
                    clearInterval(poll);
                    elements.btnProcessWatermark.disabled = false;
                    return;
                }
                const job = await res.json();
                const p = job.progress || 0;

                elements.wmProgPercentText.textContent = `${p}%`;
                elements.wmProgressFill.style.width = `${p}%`;

                if (job.status === 'completed') {
                    clearInterval(poll);
                    elements.btnProcessWatermark.disabled = false;
                    elements.wmProgStatusText.textContent = 'Exported Clean & Enhanced Video!';
                    elements.wmProgressFill.style.width = '100%';
                    elements.wmCompletedActions.style.display = 'flex';
                    state.watermarkStudio.lastCompletedFilename = job.filename;

                    showToast('Clean video exported to library!', 'success');

                    if (job.filename) {
                        addPrivateMediaItem({
                            filename: job.filename,
                            title: `Cleaned: ${job.filename}`,
                            url: `/media/${job.filename}`,
                            download_url: `/api/media/download/${job.filename}`,
                            type: 'video',
                            ext: 'mp4',
                            created_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
                            is_nowm: true
                        });
                        refreshStudioVideoSelect();
                    }

                    loadLibrary();

                    elements.btnViewCleanVideo.onclick = () => {
                        openVideoModal(`/media/${job.filename}`, job.filename, job.filename);
                    };

                    if (elements.btnDownloadCleanDirect) {
                        elements.btnDownloadCleanDirect.onclick = () => {
                            window.location.href = `/api/media/download/${encodeURIComponent(job.filename)}`;
                        };
                    }
                } else if (job.status === 'error' || job.status === 'cancelled') {
                    clearInterval(poll);
                    elements.btnProcessWatermark.disabled = false;
                    elements.wmProgStatusText.textContent = `Error: ${job.error || 'Failed'}`;
                    showToast(job.error || 'Processing error', 'error');
                }
            } catch (err) {
                console.error(err);
            }
        }, 800);
    }

    // ==========================================
    // BATCH DOWNLOADER
    // ==========================================
    elements.btnStartBatch.addEventListener('click', async () => {
        const text = elements.batchUrlsInput.value.trim();
        if (!text) {
            showToast('Please enter at least one video URL', 'error');
            return;
        }

        const urls = text.split('\n').map(u => u.trim()).filter(u => u.length > 0);
        if (urls.length === 0) return;

        const payload = {
            urls: urls,
            format_id: elements.batchFormatSelect.value,
            is_audio: elements.batchFormatSelect.value === 'best_audio',
            remove_watermark_source: elements.batchToggleNowm.checked
        };

        try {
            const res = await fetch('/api/batch-download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (res.ok && data.job_ids) {
                showToast(`Started batch download for ${data.count} items!`, 'success');
                elements.batchResultsContainer.style.display = 'block';

                data.job_ids.forEach(jid => {
                    trackDownloadJob(jid, 'Batch Item');
                });
                switchTab('downloader');
            } else {
                throw new Error(data.detail || 'Batch failed');
            }
        } catch (err) {
            showToast(err.message, 'error');
        }
    });

    // ==========================================
    // MEDIA LIBRARY (PRIVATE USER ISOLATION)
    // ==========================================
    async function loadLibrary() {
        try {
            const privateItems = getPrivateLibrary();
            updateLibraryBadge();

            if (!privateItems || privateItems.length === 0) {
                elements.emptyLibraryPlaceholder.style.display = 'flex';
                elements.libraryGridContainer.innerHTML = '';
                elements.libraryStoragePath.innerHTML = '<i class="fa-solid fa-lock"></i> Private to your session (0 items)';
                return;
            }

            // Sync with backend to check file sizes and availability
            const filenames = privateItems.map(i => i.filename).filter(Boolean);
            let serverDataMap = new Map();
            if (filenames.length > 0) {
                try {
                    const res = await fetch(`/api/library?files=${encodeURIComponent(filenames.join(','))}`);
                    if (res.ok) {
                        const data = await res.json();
                        (data.items || []).forEach(item => serverDataMap.set(item.filename, item));
                        if (data.folder) {
                            elements.settingDownloadDir.value = data.folder;
                        }
                    }
                } catch (e) {
                    console.debug('Library sync notice:', e);
                }
            }

            elements.emptyLibraryPlaceholder.style.display = 'none';
            elements.libraryGridContainer.innerHTML = '';
            elements.libraryStoragePath.innerHTML = `<i class="fa-solid fa-lock"></i> Private to your session (${privateItems.length} items)`;

            // Update Library Select dropdowns in Studio and AI Prompt Generator
            if (elements.studioVideoSelect) {
                elements.studioVideoSelect.innerHTML = '<option value="">-- Choose from downloaded videos --</option>';
                privateItems.filter(i => (i.type || '').toLowerCase() === 'video' || (i.ext || '').match(/(mp4|mov|mkv|webm|avi)/i)).forEach(vid => {
                    const opt = document.createElement('option');
                    opt.value = vid.filename;
                    opt.textContent = vid.title || vid.filename;
                    elements.studioVideoSelect.appendChild(opt);
                });
            }

            if (elements.pgenLibrarySelect) {
                elements.pgenLibrarySelect.innerHTML = '<option value="">-- Choose from downloaded videos --</option>';
                privateItems.filter(i => (i.type || '').toLowerCase() === 'video' || (i.ext || '').match(/(mp4|mov|mkv|webm|avi)/i)).forEach(vid => {
                    const opt = document.createElement('option');
                    opt.value = vid.filename;
                    opt.textContent = vid.title || vid.filename;
                    elements.pgenLibrarySelect.appendChild(opt);
                });
            }

            privateItems.forEach(item => {
                const serverItem = serverDataMap.get(item.filename);
                const sizeDisplay = serverItem?.size || item.size || 'Media';
                const fileUrl = serverItem?.url || item.url || `/media/${item.filename}`;
                const downloadUrl = serverItem?.download_url || `/api/media/download/${item.filename}`;
                const isVid = (item.type || '').toLowerCase() === 'video' || (item.ext || '').match(/(mp4|mov|mkv|webm|avi)/i);

                const card = document.createElement('div');
                card.className = 'media-card glass-card';

                card.innerHTML = `
                    <div class="media-card-preview">
                        ${isVid ? `<video src="${fileUrl}#t=0.5" preload="metadata"></video>` : '<i class="fa-solid fa-music" style="font-size:48px; color:var(--accent-cyan)"></i>'}
                        <span class="media-type-badge">${(item.ext || 'MP4').toUpperCase()}</span>
                        ${item.is_nowm ? '<span class="nowm-badge"><i class="fa-solid fa-sparkles"></i> NO WATERMARK</span>' : ''}
                        <div class="play-overlay-btn" data-url="${fileUrl}" data-title="${item.title || item.filename}" data-type="${item.type || 'video'}">
                            <i class="fa-solid ${isVid ? 'fa-play' : 'fa-volume-high'}"></i>
                        </div>
                    </div>
                    <div class="media-card-details">
                        <div class="media-card-title" title="${item.title || item.filename}">${item.title || item.filename}</div>
                        <div class="media-card-meta">
                            <span><i class="fa-solid fa-database"></i> ${sizeDisplay}</span>
                            <span>${(item.created_at || '').split(' ')[0]}</span>
                        </div>
                        <div class="media-card-actions">
                            <a href="${downloadUrl}" download="${item.filename}" class="btn-icon btn-lib-download" title="Save to Device (Phone/PC)" style="color:var(--accent-cyan)">
                                <i class="fa-solid fa-cloud-arrow-down"></i>
                            </a>
                            <button class="btn-icon btn-lib-play" title="Play Media"><i class="fa-solid fa-play"></i></button>
                            ${isVid ? `<button class="btn-icon btn-lib-wm" title="Remove Watermark in Studio"><i class="fa-solid fa-scissors"></i></button>` : ''}
                            ${isVid ? `<button class="btn-icon btn-lib-pgen" title="Generate AI Prompt" style="color:var(--accent-cyan)"><i class="fa-solid fa-wand-magic-sparkles"></i></button>` : ''}
                            <button class="btn-icon btn-lib-del" title="Delete from Library" style="color:var(--accent-rose)"><i class="fa-solid fa-trash-can"></i></button>
                        </div>
                    </div>
                `;

                // Play handlers
                const playTrigger = () => openVideoModal(fileUrl, item.title || item.filename, item.filename);
                card.querySelector('.play-overlay-btn').addEventListener('click', playTrigger);
                card.querySelector('.btn-lib-play').addEventListener('click', playTrigger);

                const downloadBtn = card.querySelector('.btn-lib-download');
                if (downloadBtn) {
                    downloadBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        triggerBrowserDownload(downloadBtn.getAttribute('href'), item.filename);
                    });
                }

                if (isVid) {
                    const wmBtn = card.querySelector('.btn-lib-wm');
                    if (wmBtn) {
                        wmBtn.addEventListener('click', () => {
                            switchTab('watermark');
                            loadVideoIntoStudio(fileUrl, item.filename);
                        });
                    }

                    const pgenBtn = card.querySelector('.btn-lib-pgen');
                    if (pgenBtn) {
                        pgenBtn.addEventListener('click', () => {
                            switchTab('promptgen');
                            loadVideoIntoPromptGen(fileUrl, item.filename);
                        });
                    }
                }

                card.querySelector('.btn-lib-del').addEventListener('click', async () => {
                    if (confirm(`Delete "${item.title || item.filename}" from your library?`)) {
                        removePrivateMediaItem(item.filename);
                        await deleteMediaFile(item.filename);
                        loadLibrary();
                    }
                });

                elements.libraryGridContainer.appendChild(card);
            });
        } catch (err) {
            console.error('Failed to load media library:', err);
        }
    }

    async function deleteMediaFile(filename) {
        try {
            await fetch(`/api/media/${filename}`, { method: 'DELETE' });
        } catch (err) {
            console.debug('Delete sync:', err);
        }
    }

    elements.btnRefreshLibrary.addEventListener('click', loadLibrary);
    if (elements.btnClearMyLibrary) {
        elements.btnClearMyLibrary.addEventListener('click', () => {
            if (confirm('Clear all items from your private download history?')) {
                savePrivateLibrary([]);
                loadLibrary();
                showToast('Private library history cleared', 'info');
            }
        });
    }
    elements.btnOpenLibraryFolder.addEventListener('click', () => openInExplorer(''));
    elements.headerOpenFolderBtn.addEventListener('click', () => openInExplorer(''));

    async function openInExplorer(filename) {
        try {
            const res = await fetch('/api/open-explorer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: filename || null })
            });
            const data = await res.json();
            if (data.message && !data.opened_locally) {
                showToast(data.message, 'info');
            }
        } catch (err) {
            console.error(err);
        }
    }

    // Modal Player
    function openVideoModal(videoUrl, title, filename) {
        elements.modalVideoTitle.textContent = title || filename || 'Media Player';
        const cleanUrl = filename ? `/media/${encodeURIComponent(filename)}` : videoUrl;
        elements.modalVideoElement.src = cleanUrl;
        elements.modalVideoElement.load();
        elements.modalVideoElement.play().catch(e => console.debug('Autoplay notice:', e));
        elements.playerModal.style.display = 'flex';

        if (elements.modalOpenWmBtn) {
            elements.modalOpenWmBtn.onclick = () => {
                elements.modalVideoElement.pause();
                elements.playerModal.style.display = 'none';
                switchTab('watermark');
                loadVideoIntoStudio(cleanUrl, filename);
            };
        }
    }

    elements.btnClosePlayer.addEventListener('click', () => {
        elements.modalVideoElement.pause();
        elements.modalVideoElement.src = '';
        elements.playerModal.style.display = 'none';
    });

    // Close modal on click backdrop
    elements.playerModal.addEventListener('click', (e) => {
        if (e.target === elements.playerModal) {
            elements.btnClosePlayer.click();
        }
    });

    // ==========================================
    // AI VIDEO-TO-PROMPT GENERATOR MODULE
    // ==========================================

    function loadVideoIntoPromptGen(videoUrl, filename, metadata = null) {
        state.promptGen.selectedVideoFilename = filename;
        state.promptGen.selectedVideoUrl = videoUrl;
        state.promptGen.selectedVideoMeta = metadata;

        elements.pgenMetaFilename.textContent = filename || 'video.mp4';
        elements.pgenPreviewVideo.src = videoUrl;
        elements.pgenPreviewVideo.load();

        if (metadata) {
            elements.pgenMetaDuration.textContent = formatTime(metadata.duration || 15);
            elements.pgenMetaResolution.textContent = `${metadata.width || 1280}x${metadata.height || 720}`;
            elements.pgenMetaAspect.textContent = metadata.aspect_ratio || '16:9';
        } else {
            elements.pgenPreviewVideo.onloadedmetadata = () => {
                elements.pgenMetaDuration.textContent = formatTime(elements.pgenPreviewVideo.duration || 0);
                elements.pgenMetaResolution.textContent = `${elements.pgenPreviewVideo.videoWidth}x${elements.pgenPreviewVideo.videoHeight}`;
                const ratio = elements.pgenPreviewVideo.videoWidth / Math.max(elements.pgenPreviewVideo.videoHeight, 1);
                elements.pgenMetaAspect.textContent = ratio < 0.7 ? '9:16 (Portrait)' : (ratio > 1.4 ? '16:9 (Landscape)' : '1:1 (Square)');
            };
        }

        elements.pgenUploadPrompt.style.display = 'none';
        elements.pgenPreviewBox.style.display = 'grid';
        elements.btnGenerateAiPrompt.disabled = false;
        elements.pgenResultCard.style.display = 'none';
        showToast('Video loaded for AI Prompt generation!', 'success');
    }

    function updateProviderBadges(provider, isActive) {
        if (provider === 'openai' && elements.openaiStatusBadge) {
            if (isActive) {
                elements.openaiStatusBadge.className = 'api-status-badge badge-active';
                elements.openaiStatusBadge.innerHTML = '<i class="fa-solid fa-circle-check"></i> GPT-4o Active (Exact Video Match)';
            } else {
                elements.openaiStatusBadge.className = 'api-status-badge badge-warning';
                elements.openaiStatusBadge.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> OpenAI Key Needed';
            }
        }
        if (provider === 'gemini' && elements.geminiStatusBadge) {
            if (isActive) {
                elements.geminiStatusBadge.className = 'api-status-badge badge-active';
                elements.geminiStatusBadge.innerHTML = '<i class="fa-solid fa-circle-check"></i> Gemini Active';
            } else {
                elements.geminiStatusBadge.className = 'api-status-badge badge-warning';
                elements.geminiStatusBadge.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Free Key Needed';
            }
        }
    }

    function initPromptGen() {
        const dropzone = elements.pgenDropzone;
        const fileInput = elements.pgenFileInput;

        // Provider switching tabs
        elements.providerTabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                elements.providerTabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const prov = btn.dataset.provider;
                state.promptGen.selectedProvider = prov;
                if (elements.paneProviderOpenai) elements.paneProviderOpenai.style.display = prov === 'openai' ? 'flex' : 'none';
                if (elements.paneProviderGemini) elements.paneProviderGemini.style.display = prov === 'gemini' ? 'flex' : 'none';
                if (elements.paneProviderLocal) elements.paneProviderLocal.style.display = prov === 'local' ? 'flex' : 'none';
            });
        });

        // Save & Verify OpenAI Key
        if (elements.btnSaveOpenaiKey) {
            elements.btnSaveOpenaiKey.addEventListener('click', async () => {
                const rawInput = (elements.pgenOpenaiKey?.value || '').trim();
                if (!rawInput) {
                    showToast('Please paste your OpenAI API Key (sk-... or sk-proj-...)', 'error');
                    return;
                }
                
                elements.btnSaveOpenaiKey.disabled = true;
                elements.btnSaveOpenaiKey.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Verifying with OpenAI...</span>';

                try {
                    const res = await fetch('/api/prompt/verify-key', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ key: rawInput, provider: 'openai' })
                    });
                    const data = await res.json();
                    
                    if (data.valid) {
                        elements.pgenOpenaiKey.value = data.clean_key;
                        if (elements.settingOpenaiApiKey) elements.settingOpenaiApiKey.value = data.clean_key;
                        updateProviderBadges('openai', true);
                        showToast('✅ OpenAI GPT-4o Vision Activated! Exact video matching is LIVE.', 'success');
                    } else {
                        updateProviderBadges('openai', false);
                        showToast(`⚠️ OpenAI Key Error: ${data.error}`, 'error');
                    }
                } catch (e) {
                    showToast('Failed to verify OpenAI key with server', 'error');
                } finally {
                    elements.btnSaveOpenaiKey.disabled = false;
                    elements.btnSaveOpenaiKey.innerHTML = '<i class="fa-solid fa-bolt"></i> <span>Verify & Activate GPT-4o</span>';
                }
            });
        }

        // Save & Verify Gemini Key
        if (elements.btnSaveGeminiKey) {
            elements.btnSaveGeminiKey.addEventListener('click', async () => {
                const rawInput = (elements.pgenGeminiKey?.value || '').trim();
                if (!rawInput) {
                    showToast('Please paste your Gemini API Key first (starts with AIzaSy...)', 'error');
                    return;
                }
                
                elements.btnSaveGeminiKey.disabled = true;
                elements.btnSaveGeminiKey.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Verifying with Google...</span>';

                try {
                    const res = await fetch('/api/prompt/verify-key', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ key: rawInput, provider: 'gemini' })
                    });
                    const data = await res.json();
                    
                    if (data.valid) {
                        elements.pgenGeminiKey.value = data.clean_key;
                        if (elements.settingGeminiApiKey) elements.settingGeminiApiKey.value = data.clean_key;
                        updateProviderBadges('gemini', true);
                        showToast('✅ Google Gemini Vision Activated!', 'success');
                    } else {
                        updateProviderBadges('gemini', false);
                        showToast(`⚠️ Gemini Key Error: ${data.error}`, 'error');
                    }
                } catch (e) {
                    showToast('Failed to verify Gemini key with server', 'error');
                } finally {
                    elements.btnSaveGeminiKey.disabled = false;
                    elements.btnSaveGeminiKey.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> <span>Verify & Activate Gemini</span>';
                }
            });
        }

        // Toggle show/hide API keys
        const btnEyeOpenai = document.getElementById('btn-toggle-eye-openai');
        if (btnEyeOpenai && elements.pgenOpenaiKey) {
            btnEyeOpenai.addEventListener('click', () => {
                const isPass = elements.pgenOpenaiKey.type === 'password';
                elements.pgenOpenaiKey.type = isPass ? 'text' : 'password';
                btnEyeOpenai.innerHTML = isPass ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
            });
        }

        const btnEyeGemini = document.getElementById('btn-toggle-eye-gemini');
        if (btnEyeGemini && elements.pgenGeminiKey) {
            btnEyeGemini.addEventListener('click', () => {
                const isPass = elements.pgenGeminiKey.type === 'password';
                elements.pgenGeminiKey.type = isPass ? 'text' : 'password';
                btnEyeGemini.innerHTML = isPass ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
            });
        }

        // Drag and Drop
        if (dropzone) {
            ['dragenter', 'dragover'].forEach(eventName => {
                dropzone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    dropzone.classList.add('dragover');
                });
            });

            ['dragleave', 'drop'].forEach(eventName => {
                dropzone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    dropzone.classList.remove('dragover');
                });
            });

            dropzone.addEventListener('drop', (e) => {
                const files = e.dataTransfer.files;
                if (files.length > 0 && files[0].type.startsWith('video/')) {
                    handlePromptVideoUpload(files[0]);
                } else {
                    showToast('Please drop a valid video file', 'error');
                }
            });
        }

        // File picker upload
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    handlePromptVideoUpload(e.target.files[0]);
                }
            });
        }

        // Handle upload API
        async function handlePromptVideoUpload(file) {
            if (!file) return;
            const formData = new FormData();
            formData.append('file', file);

            try {
                showToast('Uploading video for analysis...', 'info');
                const res = await fetch('/api/prompt/upload', {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();
                if (res.ok && data.success) {
                    addPrivateMediaItem({
                        filename: data.filename,
                        type: 'video',
                        url: data.url,
                        title: file.name
                    });
                    loadVideoIntoPromptGen(data.url, data.filename, data.metadata);
                } else {
                    throw new Error(data.detail || 'Upload failed');
                }
            } catch (err) {
                console.error(err);
                showToast(err.message, 'error');
            }
        }

        // Library video selection dropdown
        if (elements.pgenLibrarySelect) {
            elements.pgenLibrarySelect.addEventListener('change', (e) => {
                const filename = e.target.value;
                if (filename) {
                    const cleanUrl = `/media/${encodeURIComponent(filename)}`;
                    loadVideoIntoPromptGen(cleanUrl, filename);
                }
            });
        }

        // Change video button
        if (elements.btnPgenChangeVideo) {
            elements.btnPgenChangeVideo.addEventListener('click', () => {
                state.promptGen.selectedVideoFilename = null;
                state.promptGen.selectedVideoUrl = null;
                elements.pgenPreviewVideo.src = '';
                elements.pgenPreviewBox.style.display = 'none';
                elements.pgenUploadPrompt.style.display = 'block';
                elements.btnGenerateAiPrompt.disabled = true;
                elements.pgenResultCard.style.display = 'none';
                if (elements.pgenLibrarySelect) elements.pgenLibrarySelect.value = '';
            });
        }

        // Duration selector cards
        elements.durationCards.forEach(card => {
            card.addEventListener('click', () => {
                elements.durationCards.forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                const radio = card.querySelector('input[type="radio"]');
                if (radio) radio.checked = true;
                state.promptGen.selectedDuration = card.dataset.duration || '15s';
            });
        });

        // Generate AI Prompt Button
        if (elements.btnGenerateAiPrompt) {
            elements.btnGenerateAiPrompt.addEventListener('click', startPromptGeneration);
        }

        // Regenerate Button
        if (elements.btnRegeneratePrompt) {
            elements.btnRegeneratePrompt.addEventListener('click', startPromptGeneration);
        }

        async function startPromptGeneration() {
            if (!state.promptGen.selectedVideoFilename) {
                showToast('Please upload or select a video first', 'error');
                return;
            }

            const openaiKey = (elements.pgenOpenaiKey?.value || elements.settingOpenaiApiKey?.value || '').trim();
            const geminiKey = (elements.pgenGeminiKey?.value || elements.settingGeminiApiKey?.value || '').trim();
            const provider = state.promptGen.selectedProvider || 'openai';

            const payload = {
                video_filename: state.promptGen.selectedVideoFilename,
                duration: state.promptGen.selectedDuration,
                openai_api_key: openaiKey || null,
                gemini_api_key: geminiKey || null,
                provider: provider
            };

            elements.btnGenerateAiPrompt.disabled = true;
            elements.btnGenerateAiPrompt.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Analyzing Video...</span>';
            elements.pgenProgressBox.style.display = 'flex';
            elements.pgenProgressFill.style.width = '10%';
            elements.pgenPercentText.textContent = '10%';
            elements.pgenStatusText.textContent = 'Extracting sequential keyframes across video...';
            elements.pgenResultCard.style.display = 'none';

            try {
                const res = await fetch('/api/prompt/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (!res.ok || !data.job_id) {
                    throw new Error(data.detail || 'Failed to start prompt generation');
                }

                state.promptGen.activeJobId = data.job_id;
                pollPromptJob(data.job_id);

            } catch (err) {
                console.error(err);
                showToast(err.message, 'error');
                elements.btnGenerateAiPrompt.disabled = false;
                elements.btnGenerateAiPrompt.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> <span>Generate AI Prompt</span>';
                elements.pgenProgressBox.style.display = 'none';
            }
        }

        function pollPromptJob(jobId) {
            if (state.promptGen.pollTimer) clearInterval(state.promptGen.pollTimer);

            state.promptGen.pollTimer = setInterval(async () => {
                try {
                    const res = await fetch(`/api/prompt/job/${jobId}`);
                    if (!res.ok) throw new Error('Job poll error');
                    const job = await res.json();

                    // Update UI progress
                    const pct = Math.min(Math.max(job.progress || 0, 10), 100);
                    elements.pgenProgressFill.style.width = `${pct}%`;
                    elements.pgenPercentText.textContent = `${pct}%`;
                    elements.pgenStatusText.textContent = job.step_description || 'Processing video analysis...';

                    if (job.status === 'completed') {
                        clearInterval(state.promptGen.pollTimer);
                        state.promptGen.pollTimer = null;
                        elements.pgenProgressBox.style.display = 'none';
                        elements.btnGenerateAiPrompt.disabled = false;
                        elements.btnGenerateAiPrompt.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> <span>Generate AI Prompt</span>';
                        
                        state.promptGen.lastResult = job.result;
                        renderPromptResult(job.result, job.engine_used);
                        showToast(`AI Video Prompt Generated for ${job.duration_target || state.promptGen.selectedDuration}!`, 'success');
                    } else if (job.status === 'failed') {
                        clearInterval(state.promptGen.pollTimer);
                        state.promptGen.pollTimer = null;
                        elements.pgenProgressBox.style.display = 'none';
                        elements.btnGenerateAiPrompt.disabled = false;
                        elements.btnGenerateAiPrompt.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> <span>Generate AI Prompt</span>';
                        showToast(`Generation failed: ${job.error || 'Unknown error'}`, 'error');
                    }
                } catch (e) {
                    console.debug('Prompt poll retry:', e);
                }
            }, 800);
        }

        function renderPromptResult(result, engineUsed) {
            if (!result) return;

            // Master Prompt
            elements.pgenOutputMasterText.textContent = result.master_prompt || '';

            // Timeline Steps
            elements.pgenOutputTimeline.innerHTML = '';
            const timeline = result.timeline_breakdown || [];
            if (Array.isArray(timeline) && timeline.length > 0) {
                timeline.forEach((step, idx) => {
                    const stepItem = document.createElement('div');
                    stepItem.className = 'timeline-step-item';
                    stepItem.innerHTML = `
                        <div class="timeline-step-header">
                            <span class="timeline-time-badge">${step.time_range || `Phase ${idx+1}`}</span>
                            <h4 class="timeline-step-title">${step.scene_title || `Scene ${idx+1}`}</h4>
                        </div>
                        <p class="timeline-step-body">${step.visual_action || ''}</p>
                        <div class="timeline-step-meta">
                            ${step.camera_motion ? `<div><strong>Camera:</strong> ${step.camera_motion}</div>` : ''}
                            ${step.audio_cues ? `<div><strong>Sound / ASMR:</strong> ${step.audio_cues}</div>` : ''}
                        </div>
                    `;
                    elements.pgenOutputTimeline.appendChild(stepItem);
                });
            } else {
                elements.pgenOutputTimeline.innerHTML = '<p class="text-muted">No timeline breakdown available.</p>';
            }

            // Specs
            elements.pgenOutputCamera.textContent = result.camera_direction || 'Continuous fluid tracking and dynamic rack focus.';
            elements.pgenOutputStyle.textContent = result.visual_style || 'Photorealistic 8K cinematic lighting and natural atmosphere.';
            elements.pgenOutputSound.textContent = result.sound_fx_asmr || 'Spatial tactile foley and delicate ambient audio.';
            elements.pgenOutputTags.textContent = result.ai_tags || '8k, cinematic lighting, 35mm prime lens, ultra-detailed texture.';

            if (elements.pgenEngineTag) {
                const engineText = engineUsed || 'Smart Vision Engine';
                elements.pgenEngineTag.innerHTML = `<i class="fa-solid fa-shield-halved"></i> Copyright-Clean &bull; Powered by ${engineText}`;
            }

            // Show result card
            elements.pgenResultCard.style.display = 'flex';
            elements.pgenResultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        // Subtabs in Prompt Output
        elements.promptTabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                elements.promptTabBtns.forEach(b => b.classList.remove('active'));
                elements.promptTabContents.forEach(c => c.classList.remove('active'));

                btn.classList.add('active');
                const targetTab = btn.dataset.ptab;
                const contentEl = document.getElementById(`ptab-${targetTab}`);
                if (contentEl) contentEl.classList.add('active');
            });
        });

        // Copy Master Prompt Handler
        function copyPromptToClipboard(buttonEl) {
            const promptText = elements.pgenOutputMasterText.textContent;
            if (!promptText) {
                showToast('No prompt to copy', 'error');
                return;
            }

            navigator.clipboard.writeText(promptText).then(() => {
                showToast('AI Video Prompt copied to clipboard! Ready to paste.', 'success');
                if (buttonEl) {
                    const originalHtml = buttonEl.innerHTML;
                    buttonEl.classList.add('copied');
                    buttonEl.innerHTML = '<i class="fa-solid fa-check"></i> <span>Copied!</span>';
                    setTimeout(() => {
                        buttonEl.classList.remove('copied');
                        buttonEl.innerHTML = originalHtml;
                    }, 2500);
                }
            }).catch(err => {
                console.error('Clipboard copy failed:', err);
                showToast('Could not copy automatically. Please select text manually.', 'error');
            });
        }

        if (elements.btnCopyMasterPrompt) {
            elements.btnCopyMasterPrompt.addEventListener('click', () => copyPromptToClipboard(elements.btnCopyMasterPrompt));
        }

        if (elements.btnCopyPromptBottom) {
            elements.btnCopyPromptBottom.addEventListener('click', () => copyPromptToClipboard(elements.btnCopyPromptBottom));
        }

        // Download Prompt as .TXT
        if (elements.btnDownloadPromptTxt) {
            elements.btnDownloadPromptTxt.addEventListener('click', () => {
                const res = state.promptGen.lastResult;
                if (!res) {
                    showToast('No prompt generated yet', 'error');
                    return;
                }

                let txtContent = `=====================================================\n`;
                txtContent += `OMNIDOWNLOADER PRO - AI VIDEO GENERATION PROMPT\n`;
                txtContent += `Target Duration: ${res.duration || state.promptGen.selectedDuration}\n`;
                txtContent += `Generated at: ${new Date().toLocaleString()}\n`;
                txtContent += `=====================================================\n\n`;

                txtContent += `[MASTER AI VIDEO PROMPT]\n`;
                txtContent += `${res.master_prompt}\n\n`;

                txtContent += `-----------------------------------------------------\n`;
                txtContent += `[TIMELINE BREAKDOWN]\n`;
                txtContent += `-----------------------------------------------------\n`;
                (res.timeline_breakdown || []).forEach(step => {
                    txtContent += `• ${step.time_range} - ${step.scene_title}:\n`;
                    txtContent += `  Action: ${step.visual_action}\n`;
                    if (step.camera_motion) txtContent += `  Camera: ${step.camera_motion}\n`;
                    if (step.audio_cues) txtContent += `  Audio/ASMR: ${step.audio_cues}\n`;
                    txtContent += `\n`;
                });

                txtContent += `-----------------------------------------------------\n`;
                txtContent += `[CINEMATOGRAPHY & VISUAL STYLE]\n`;
                txtContent += `-----------------------------------------------------\n`;
                txtContent += `Camera: ${res.camera_direction}\n`;
                txtContent += `Style: ${res.visual_style}\n\n`;

                txtContent += `-----------------------------------------------------\n`;
                txtContent += `[SOUND & ASMR FOLEY CUES]\n`;
                txtContent += `-----------------------------------------------------\n`;
                txtContent += `${res.sound_fx_asmr}\n\n`;

                txtContent += `-----------------------------------------------------\n`;
                txtContent += `[AI MODEL PARAMETERS & TAGS]\n`;
                txtContent += `-----------------------------------------------------\n`;
                txtContent += `${res.ai_tags}\n`;

                const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `AI_Video_Prompt_${res.duration || '15s'}_${Date.now()}.txt`;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    a.remove();
                    URL.revokeObjectURL(url);
                }, 300);

                showToast('Prompt downloaded as .TXT file', 'success');
            });
        }
    }

    // ==========================================
    // SETTINGS
    // ==========================================
    async function loadSettings() {
        try {
            const res = await fetch('/api/settings');
            const data = await res.json();

            elements.settingDownloadDir.value = data.download_dir || '';
            elements.settingAutoNowm.checked = !!data.auto_remove_watermark;
            elements.settingAudioBitrate.value = data.audio_bitrate || '320';
            
            const openaiKey = data.openai_api_key || '';
            if (elements.settingOpenaiApiKey) elements.settingOpenaiApiKey.value = openaiKey;
            if (elements.pgenOpenaiKey) elements.pgenOpenaiKey.value = openaiKey;
            updateProviderBadges('openai', !!openaiKey.trim());

            const geminiKey = data.gemini_api_key || '';
            if (elements.settingGeminiApiKey) elements.settingGeminiApiKey.value = geminiKey;
            if (elements.pgenGeminiKey) elements.pgenGeminiKey.value = geminiKey;
            updateProviderBadges('gemini', !!geminiKey.trim());

            if (data.ffmpeg_available) {
                elements.settingFfmpegStatus.innerHTML = '<i class="fa-solid fa-circle-check"></i> Installed & Operational';
                elements.settingFfmpegStatus.className = 'badge-success';
            }
        } catch (err) {
            console.error(err);
        }
    }

    elements.btnSaveSettings.addEventListener('click', async () => {
        const openaiKey = (elements.settingOpenaiApiKey ? elements.settingOpenaiApiKey.value.trim() : '');
        const geminiKey = (elements.settingGeminiApiKey ? elements.settingGeminiApiKey.value.trim() : '');
        const payload = {
            auto_remove_watermark: elements.settingAutoNowm.checked,
            audio_bitrate: elements.settingAudioBitrate.value,
            openai_api_key: openaiKey,
            gemini_api_key: geminiKey
        };

        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                if (elements.pgenOpenaiKey) elements.pgenOpenaiKey.value = openaiKey;
                if (elements.pgenGeminiKey) elements.pgenGeminiKey.value = geminiKey;
                updateProviderBadges('openai', !!openaiKey);
                updateProviderBadges('gemini', !!geminiKey);
                showToast('Settings saved successfully!', 'success');
            }
        } catch (err) {
            showToast('Failed to save settings', 'error');
        }
    });

    elements.btnSettingOpenDir.addEventListener('click', () => openInExplorer(''));

    // Initializations
    initWatermarkCanvas();
    initPromptGen();
    loadLibrary();
    loadSettings();
});

