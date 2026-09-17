// ==UserScript==
// @name         Subtitle Ball
// @name:zh-CN   字幕懸浮球
// @namespace    https://github.com/neo2codes/subtitle-ball
// @version      1.0.0
// @description  A draggable floating-ball subtitle panel for any website with a video player. Load local SRT files, fine-tune subtitle appearance and position, adjust picture brightness/contrast/saturation, and control everything with hotkeys. Works on Chrome (Tampermonkey) and Safari (Userscripts).
// @description:zh-CN  為任何有影片播放器嘅網站提供可拖拽字幕懸浮球：載入本地 SRT、調節字幕外觀同位置、調整畫面亮度對比飽和度、快捷鍵控制。支援 Chrome (Tampermonkey) 同 Safari (Userscripts)。
// @author       Subtitle Ball Contributors
// @match        *://*/*
// @noframes
// @license      MIT
// @run-at       document-end
// @updateURL    https://raw.githubusercontent.com/neo2codes/subtitle-ball/main/subtitle-ball.user.js
// @downloadURL  https://raw.githubusercontent.com/neo2codes/subtitle-ball/main/subtitle-ball.user.js
// ==/UserScript==

/* ============================================
   Subtitle Ball — v1.0.0 — 2026-09
   First public release.

   A universal floating-ball subtitle panel for any website with an HTML5
   video player. Everything runs locally in your browser: no account, no
   network calls, no telemetry.

   Features
   - Load a local .srt file and overlay it on the page's video element
   - Draggable floating ball, remembers its position
   - Subtitle appearance: colour, font size, vertical position
   - Picture adjustment: brightness / contrast / saturation
   - Hotkeys: skip, accelerate, picture adjustments, ESC to collapse
   - Works on Chrome (Tampermonkey) and Safari (Userscripts)

   Notes
   - Settings are stored locally in your browser. Nothing is uploaded.
   - Open source under the MIT licence.
   ============================================ */

(function () {
    'use strict';

    const PLAYER_STATE_EVENT = 'subtitleball-player-state';
    const PLAYER_STATE_ATTR = 'data-subtitleball-player-state';
    const PLAYER_BRIDGE_ID = 'subtitleball-player-bridge';
    const FLOATING_BUTTON_POSITION_KEY = 'subtitleBallFloatingButtonPosition';
    const FLOATING_UI_GAP = 8;
    const VIDEO_QUERY_SELECTORS = [
        'video#player',
        '.plyr video',
        '.video-js video',
        '.jwplayer video',
        'video'
    ];
    const VIDEO_CONTAINER_SELECTORS = [
        '.plyr__video-wrapper',
        '.player-container',
        '#player-container',
        '.video-js',
        '.jwplayer',
        '.jw-wrapper',
        '.video-img-box',
        '.video-player'
    ];
    const VIDEO_ANCESTOR_SELECTORS = [
        ...VIDEO_CONTAINER_SELECTORS,
        '.plyr',
        '.player',
        '[class*="video-player"]',
        '[class*="player"]'
    ];

    // --- Styles — Studio Noir Theme ---
    addStyle(`
        .custom-control-panel {
            position: fixed;
            left: 12px;
            bottom: 78px;
            background: #1a1a2e;
            color: #e8e8e8;
            padding: 12px 14px;
            padding-top: 34px;
            z-index: 9999;
            border-radius: 12px;
            width: min(292px, calc(100vw - 24px));
            max-height: min(560px, calc(100vh - 120px));
            overflow-y: auto;
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
            font-size: 14px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(74, 158, 255, 0.15);
            border: 1px solid rgba(74, 158, 255, 0.12);
            backdrop-filter: blur(12px);
            transition: all 0.3s ease;
            display: none;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px 10px;
            align-items: end;
        }
        .custom-control-panel label {
            margin-right: 0;
            display: block;
            min-width: 0;
            text-align: left;
            color: rgba(232, 232, 232, 0.8);
            font-weight: 500;
            font-size: 12px;
            line-height: 1.2;
            letter-spacing: 0.3px;
            text-transform: uppercase;
        }
        .custom-control-panel input[type="number"],
        .custom-control-panel input[type="text"],
        .custom-control-panel input[type="color"] {
            width: 100%;
            margin-right: 0;
            color: #e8e8e8;
            background: rgba(15, 52, 96, 0.5);
            border: 1px solid rgba(74, 158, 255, 0.2);
            border-radius: 8px;
            padding: 5px 8px;
            box-sizing: border-box;
            transition: all 0.2s ease;
            font-size: 13px;
            height: 30px;
        }
        .custom-control-panel input[type="number"]:focus,
        .custom-control-panel input[type="text"]:focus,
        .custom-control-panel input[type="color"]:focus {
            outline: none;
            border-color: rgba(74, 158, 255, 0.6);
            background: rgba(15, 52, 96, 0.7);
            box-shadow: 0 0 10px rgba(74, 158, 255, 0.15);
        }
        .custom-control-panel input[type="color"] {
            padding: 2px;
            min-width: 56px;
            cursor: pointer;
        }
         /* Specific width for offset/position inputs */
        .custom-control-panel input[data-key-name="subtitleOffset"],
        .custom-control-panel input[data-key-name="subtitlePosition"] {
             width: 100%;
        }
        .custom-control-panel button {
            background: linear-gradient(135deg, #0f3460, #16213e);
            border: 1px solid rgba(74, 158, 255, 0.25);
            color: #e8e8e8;
            padding: 7px 8px;
            border-radius: 8px;
            cursor: pointer;
            margin: 0;
            font-size: 12px;
            font-weight: 500;
            transition: all 0.2s ease;
            box-shadow: 0 2px 8px rgba(15, 52, 96, 0.4);
            white-space: nowrap;
            min-height: 30px;
        }
        .custom-control-panel button:hover {
            background: linear-gradient(135deg, #1a4a7a, #0f3460);
            border-color: rgba(74, 158, 255, 0.5);
            transform: translateY(-1px);
            box-shadow: 0 4px 16px rgba(74, 158, 255, 0.2);
        }
        .custom-control-panel button:active {
            transform: translateY(0);
            box-shadow: 0 1px 4px rgba(74, 158, 255, 0.15);
        }
        .custom-control-panel .input-group {
            margin-bottom: 0;
            display: grid;
            grid-template-columns: minmax(0, 1fr) 56px;
            align-items: center;
            gap: 6px;
            min-width: 0;
        }
        .custom-control-panel .button-group {
            grid-column: 1 / -1;
            margin-top: 2px;
            border-top: 1px solid rgba(74, 158, 255, 0.12);
            padding-top: 10px;
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 6px;
        }
        .custom-subtitle {
            position: absolute;
            left: 50%;
            transform: translateX(-50%);
            color: #ffffff;
            font-size: 26px;
            font-weight: 600;
            text-shadow: 2px 2px 8px rgba(0,0,0,0.95), 0 0 4px rgba(0,0,0,0.5);
            background: rgba(0,0,0,0.0);
            padding: 5px 12px;
            border-radius: 6px;
            max-width: 85%;
            text-align: center;
            transition: opacity 0.3s, bottom 0.2s ease-out;
            z-index: 10000;
            pointer-events: none;
        }
        .show-controls-button {
            position: fixed;
            left: 14px;
            bottom: 16px;
            background: linear-gradient(135deg, #0f3460, #1a1a2e);
            color: #e8e8e8;
            width: 52px;
            height: 52px;
            padding: 0;
            border: 1px solid rgba(74, 158, 255, 0.25);
            border-radius: 999px;
            cursor: pointer;
            z-index: 9998;
            font-size: 12px;
            font-weight: 600;
            box-shadow: 0 4px 20px rgba(15, 52, 96, 0.5);
            transition: all 0.3s ease;
            backdrop-filter: blur(8px);
            display: flex;
            align-items: center;
            justify-content: center;
            user-select: none;
            -webkit-user-select: none;
            touch-action: none;
            cursor: grab;
        }
        .show-controls-button:hover {
            background: linear-gradient(135deg, #1a4a7a, #0f3460);
            border-color: rgba(74, 158, 255, 0.5);
            transform: translateY(-2px) scale(1.02);
            box-shadow: 0 6px 24px rgba(74, 158, 255, 0.25);
        }
        .show-controls-button.dragging {
            transition: none;
            transform: none;
            cursor: grabbing;
        }
        .custom-control-panel button.full-width {
            grid-column: 1 / -1;
        }
        /* Panel close button (✕) */
        .panel-close-btn {
            position: absolute;
            top: 6px;
            right: 6px;
            width: 24px;
            height: 24px;
            padding: 0;
            border: none;
            border-radius: 6px;
            background: rgba(74, 158, 255, 0.1);
            color: rgba(232, 232, 232, 0.5);
            font-size: 14px;
            cursor: pointer;
            z-index: 10;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .panel-close-btn:hover {
            background: rgba(233, 69, 96, 0.3);
            color: #e94560;
        }
        @media (max-width: 640px) {
            .custom-control-panel {
                left: 10px;
                width: auto;
                max-height: calc(100vh - 108px);
                bottom: 74px;
            }
            .show-controls-button {
                left: 12px;
                bottom: 14px;
            }
        }
    `);

    // --- Global Variables ---
    let accelerationRate = parseFloat(localStorage.getItem('subtitleBallAccelerationRate')) || 3;
    let skipTime = parseFloat(localStorage.getItem('subtitleBallSkipTime')) || 5;
    let subtitleOffset = parseFloat(localStorage.getItem('subtitleBallSubtitleOffset')) || 0;
    let subtitleVerticalPositionPercent = parseFloat(localStorage.getItem('subtitleBallSubtitlePosition')) || 15; // Default 15% from bottom
    let subtitleFontSize = parseFloat(localStorage.getItem('subtitleBallSubtitleSize')) || 26;
    let subtitleColor = normalizeHexColor(localStorage.getItem('subtitleBallSubtitleColor')) || '#ffffff';
    let isAccelerating = false;
    let floatingButtonPosition = null;
    let floatingButtonDragState = null;
    let suppressFloatingButtonClick = false;
    let videoElement = null;
    let playerMonitorInterval = null;
    let hasShownPlayerReadyToast = false;
    let subtitleTrack = null;
    let subtitleTrackOwner = null;
    let playerBridgeState = {
        currentTime: 0,
        paused: true,
        ended: false,
        seeking: false,
        reason: ''
    };
    let isBridgeActive = false;
    let subtitles = [];
    let originalSubtitleText = '';
    // Video picture adjustments (VLC-style) — CSS filter on the <video> element
    let videoBrightness = clamp(parseFloat(localStorage.getItem('subtitleBallVideoBrightness')) || 1.0, 0.5, 2.0);
    let videoContrast = clamp(parseFloat(localStorage.getItem('subtitleBallVideoContrast')) || 1.0, 0.5, 2.0);
    let videoSaturation = clamp(parseFloat(localStorage.getItem('subtitleBallVideoSaturate')) || 1.0, 0, 2.0);
    // Which adjustment the next hotkey press targets (cycle: brightness → contrast → saturation)
    let videoFilterTarget = 'brightness';
    let shortcutKeys = {
        accelerate: localStorage.getItem('subtitleBallAccelerateKey') || 'z',
        forward: localStorage.getItem('subtitleBallForwardKey') || 'c',
        backward: localStorage.getItem('subtitleBallBackwardKey') || 'x'
    };

    // --- UI Elements ---
    let controlPanel;
    let subtitleElement;
    let videoContainer;
    let showControlsButton = null;

    // --- Functions ---

    function addStyle(css) {
        const style = document.createElement('style');
        style.textContent = css;
        (document.head || document.documentElement).appendChild(style);
        return style;
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function normalizeHexColor(value) {
        if (typeof value !== 'string') return null;

        const normalized = value.trim().toLowerCase();
        if (/^#[0-9a-f]{6}$/i.test(normalized)) {
            return normalized;
        }

        if (/^#[0-9a-f]{3}$/i.test(normalized)) {
            return `#${normalized.slice(1).split('').map((char) => char + char).join('')}`;
        }

        return null;
    }

    function getViewportMargin() {
        return window.innerWidth <= 640 ? 10 : 12;
    }

    function loadFloatingButtonPosition() {
        try {
            const raw = localStorage.getItem(FLOATING_BUTTON_POSITION_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!Number.isFinite(parsed?.left) || !Number.isFinite(parsed?.top)) {
                return null;
            }
            return { left: parsed.left, top: parsed.top };
        } catch (error) {
            console.warn('Subtitle Ball: Failed to load floating button position.', error);
            return null;
        }
    }

    function saveFloatingButtonPosition() {
        if (!floatingButtonPosition) return;

        try {
            localStorage.setItem(FLOATING_BUTTON_POSITION_KEY, JSON.stringify(floatingButtonPosition));
        } catch (error) {
            console.warn('Subtitle Ball: Failed to save floating button position.', error);
        }
    }

    function clampFloatingButtonPosition(position) {
        const margin = getViewportMargin();
        const buttonWidth = showControlsButton?.offsetWidth || 52;
        const buttonHeight = showControlsButton?.offsetHeight || 52;

        return {
            left: clamp(position.left, margin, Math.max(margin, window.innerWidth - buttonWidth - margin)),
            top: clamp(position.top, margin, Math.max(margin, window.innerHeight - buttonHeight - margin))
        };
    }

    function getDefaultFloatingButtonPosition() {
        const margin = getViewportMargin();
        const buttonHeight = showControlsButton?.offsetHeight || 52;
        return clampFloatingButtonPosition({
            left: margin + 2,
            top: window.innerHeight - buttonHeight - 16
        });
    }

    function applyFloatingButtonPosition() {
        if (!showControlsButton) return;

        if (!floatingButtonPosition) {
            floatingButtonPosition = loadFloatingButtonPosition() || getDefaultFloatingButtonPosition();
        }

        floatingButtonPosition = clampFloatingButtonPosition(floatingButtonPosition);
        showControlsButton.style.left = `${floatingButtonPosition.left}px`;
        showControlsButton.style.top = `${floatingButtonPosition.top}px`;
        showControlsButton.style.right = 'auto';
        showControlsButton.style.bottom = 'auto';
    }

    function getBallAnchorRect() {
        if (!showControlsButton) return null;
        applyFloatingButtonPosition();

        if (showControlsButton.style.display !== 'none') {
            const rect = showControlsButton.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                return rect;
            }
        }

        const buttonWidth = showControlsButton.offsetWidth || 52;
        const buttonHeight = showControlsButton.offsetHeight || 52;
        const position = floatingButtonPosition || getDefaultFloatingButtonPosition();

        return {
            left: position.left,
            top: position.top,
            right: position.left + buttonWidth,
            bottom: position.top + buttonHeight,
            width: buttonWidth,
            height: buttonHeight
        };
    }

    function positionControlPanel() {
        if (!controlPanel || controlPanel.style.display === 'none') return;

        const anchorRect = getBallAnchorRect();
        if (!anchorRect) return;

        const margin = getViewportMargin();
        const gap = FLOATING_UI_GAP;
        const panelWidth = Math.min(controlPanel.offsetWidth || 292, Math.max(220, window.innerWidth - margin * 2));
        controlPanel.style.width = `${panelWidth}px`;
        controlPanel.style.maxHeight = `${Math.max(200, window.innerHeight - margin * 2)}px`;

        const panelHeight = Math.min(controlPanel.scrollHeight, window.innerHeight - margin * 2);
        const alignRight = anchorRect.left > window.innerWidth / 2;
        const preferredLeft = alignRight ? anchorRect.right - panelWidth : anchorRect.left;
        const left = clamp(preferredLeft, margin, Math.max(margin, window.innerWidth - panelWidth - margin));

        const spaceAbove = anchorRect.top - margin - gap;
        const spaceBelow = window.innerHeight - anchorRect.bottom - margin - gap;
        const shouldOpenAbove = spaceAbove >= panelHeight || spaceAbove >= spaceBelow;
        const preferredTop = shouldOpenAbove
            ? anchorRect.top - panelHeight - gap
            : anchorRect.bottom + gap;
        const top = clamp(preferredTop, margin, Math.max(margin, window.innerHeight - panelHeight - margin));

        controlPanel.style.left = `${left}px`;
        controlPanel.style.top = `${top}px`;
        controlPanel.style.right = 'auto';
        controlPanel.style.bottom = 'auto';
    }

    function cleanupFloatingButtonDrag() {
        document.removeEventListener('pointermove', handleFloatingButtonPointerMove);
        document.removeEventListener('pointerup', handleFloatingButtonPointerUp);
        document.removeEventListener('pointercancel', handleFloatingButtonPointerUp);
    }

    function handleFloatingButtonPointerMove(event) {
        if (!floatingButtonDragState) return;

        const deltaX = event.clientX - floatingButtonDragState.startX;
        const deltaY = event.clientY - floatingButtonDragState.startY;
        if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
            suppressFloatingButtonClick = true;
        }

        floatingButtonPosition = clampFloatingButtonPosition({
            left: floatingButtonDragState.originLeft + deltaX,
            top: floatingButtonDragState.originTop + deltaY
        });

        applyFloatingButtonPosition();
        positionControlPanel();
    }

    function handleFloatingButtonPointerUp(event) {
        if (showControlsButton?.classList.contains('dragging')) {
            showControlsButton.classList.remove('dragging');
        }

        if (showControlsButton && floatingButtonDragState && event.pointerId !== undefined && showControlsButton.hasPointerCapture?.(event.pointerId)) {
            showControlsButton.releasePointerCapture(event.pointerId);
        }

        cleanupFloatingButtonDrag();

        if (floatingButtonDragState && suppressFloatingButtonClick) {
            saveFloatingButtonPosition();
        }

        floatingButtonDragState = null;
    }

    function handleFloatingButtonPointerDown(event) {
        if (event.button !== undefined && event.button !== 0) return;
        if (!showControlsButton) return;

        applyFloatingButtonPosition();
        const rect = showControlsButton.getBoundingClientRect();
        floatingButtonDragState = {
            startX: event.clientX,
            startY: event.clientY,
            originLeft: rect.left,
            originTop: rect.top
        };
        suppressFloatingButtonClick = false;
        showControlsButton.classList.add('dragging');

        if (event.pointerId !== undefined) {
            showControlsButton.setPointerCapture?.(event.pointerId);
        }

        document.addEventListener('pointermove', handleFloatingButtonPointerMove);
        document.addEventListener('pointerup', handleFloatingButtonPointerUp);
        document.addEventListener('pointercancel', handleFloatingButtonPointerUp);
    }

    function handleFloatingButtonClick(event) {
        if (suppressFloatingButtonClick) {
            suppressFloatingButtonClick = false;
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        showControlPanel();
    }

    function handleViewportChange() {
        applyFloatingButtonPosition();
        positionControlPanel();
    }

    function findPageVideo(root = document) {
        for (const selector of VIDEO_QUERY_SELECTORS) {
            const candidate = root.querySelector(selector);
            if (candidate instanceof HTMLVideoElement) {
                return candidate;
            }
        }

        const fallbackVideo = root.querySelector('video');
        return fallbackVideo instanceof HTMLVideoElement ? fallbackVideo : null;
    }

    function findVideoContainer(video = null) {
        const currentVideo = video || findVideoElement() || findPageVideo();

        if (currentVideo) {
            for (const selector of VIDEO_ANCESTOR_SELECTORS) {
                const candidate = currentVideo.closest(selector);
                if (candidate && candidate !== document.body && candidate !== document.documentElement) {
                    return candidate;
                }
            }

            if (currentVideo.parentElement) {
                return currentVideo.parentElement;
            }
        }

        for (const selector of VIDEO_CONTAINER_SELECTORS) {
            const candidate = document.querySelector(selector);
            if (candidate) {
                return candidate;
            }
        }

        return null;
    }

    function scoreVideoElement(video) {
        if (!video) return -Infinity;

        const rect = video.getBoundingClientRect();
        const style = getComputedStyle(video);
        const isVisible = style.display !== 'none'
            && style.visibility !== 'hidden'
            && parseFloat(style.opacity || '1') !== 0
            && rect.width >= 160
            && rect.height >= 90;
        const hasSource = Boolean(video.currentSrc || video.src);
        const isLikelyPlayer = video.id === 'player'
            || video.closest('.plyr')
            || video.closest('.player')
            || video.closest('.video-js')
            || video.closest('.jwplayer')
            || video.closest('[class*="video-player"]');
        const isPlaying = !video.paused && !video.ended;

        return (isLikelyPlayer ? 1_000_000 : 0)
            + (isVisible ? 100_000 : 0)
            + (isPlaying ? 10_000 : 0)
            + (hasSource ? 1_000 : 0)
            + Math.round(rect.width * rect.height);
    }

    function injectPlayerBridge() {
        if (document.getElementById(PLAYER_BRIDGE_ID)) return;

        const bridgeScript = document.createElement('script');
        bridgeScript.id = PLAYER_BRIDGE_ID;
        bridgeScript.textContent = `
            (() => {
                const EVENT_NAME = ${JSON.stringify(PLAYER_STATE_EVENT)};
                const STATE_ATTR = ${JSON.stringify(PLAYER_STATE_ATTR)};
                const VIDEO_SELECTORS = ${JSON.stringify(VIDEO_QUERY_SELECTORS)};
                if (window.__SUBTITLEBALL_PLAYER_BRIDGE__) return;
                window.__SUBTITLEBALL_PLAYER_BRIDGE__ = true;

                let boundPlayer = null;
                let media = null;
                let rafId = null;
                let rvfcId = null;

                const mediaEvents = ['play', 'playing', 'pause', 'seeking', 'seeked', 'waiting', 'ended', 'loadedmetadata', 'ratechange'];
                const findMediaElement = () => {
                    for (const selector of VIDEO_SELECTORS) {
                        const candidate = document.querySelector(selector);
                        if (candidate instanceof HTMLVideoElement) {
                            return candidate;
                        }
                    }
                    return document.querySelector('video');
                };

                const emit = (reason) => {
                    const currentTime = media && typeof media.currentTime === 'number'
                        ? media.currentTime
                        : boundPlayer && typeof boundPlayer.currentTime === 'number'
                            ? boundPlayer.currentTime
                            : 0;

                    const root = document.documentElement;
                    if (root) {
                        root.setAttribute(STATE_ATTR, JSON.stringify({
                            currentTime,
                            paused: media ? !!media.paused : !(boundPlayer && !boundPlayer.paused),
                            ended: media ? !!media.ended : false,
                            seeking: media ? !!media.seeking : false,
                            reason
                        }));
                    }

                    document.dispatchEvent(new CustomEvent(EVENT_NAME));
                };

                const stopLoop = () => {
                    if (media && typeof media.cancelVideoFrameCallback === 'function' && rvfcId !== null) {
                        try { media.cancelVideoFrameCallback(rvfcId); } catch (error) {}
                    }
                    if (rafId !== null) {
                        cancelAnimationFrame(rafId);
                    }
                    rafId = null;
                    rvfcId = null;
                };

                const frameStep = () => {
                    emit('frame');
                    startLoop();
                };

                const startLoop = () => {
                    stopLoop();
                    if (!media || media.paused || media.ended || document.visibilityState === 'hidden') {
                        return;
                    }

                    if (typeof media.requestVideoFrameCallback === 'function') {
                        rvfcId = media.requestVideoFrameCallback(() => frameStep());
                    } else {
                        rafId = requestAnimationFrame(frameStep);
                    }
                };

                const onMediaEvent = (event) => {
                    emit(event.type);
                    if (event.type === 'pause' || event.type === 'waiting' || event.type === 'ended') {
                        stopLoop();
                        return;
                    }
                    startLoop();
                };

                const cleanupMedia = () => {
                    stopLoop();
                    if (media) {
                        mediaEvents.forEach((eventName) => media.removeEventListener(eventName, onMediaEvent));
                    }
                };

                const bindMedia = (nextMedia, player = null) => {
                    if (!nextMedia) return false;

                    if (boundPlayer === player && media === nextMedia && nextMedia.isConnected) {
                        return true;
                    }

                    cleanupMedia();
                    boundPlayer = player;
                    media = nextMedia;
                    mediaEvents.forEach((eventName) => media.addEventListener(eventName, onMediaEvent, { passive: true }));
                    emit('bind');
                    startLoop();
                    return true;
                };

                const bindPlayer = (player) => {
                    if (!player) return false;
                    const nextMedia = player.media || findMediaElement();
                    return bindMedia(nextMedia, player);
                };

                const getPlayerCandidates = () => {
                    const candidates = [];
                    if (window.player) candidates.push(window.player);
                    if (window.plyr) candidates.push(window.plyr);
                    if (typeof window.videojs === 'function' && typeof window.videojs.getPlayers === 'function') {
                        candidates.push(...Object.values(window.videojs.getPlayers()));
                    }
                    return candidates.filter(Boolean);
                };

                document.addEventListener('visibilitychange', () => {
                    emit('visibilitychange');
                    if (document.visibilityState === 'hidden') {
                        stopLoop();
                    } else {
                        startLoop();
                    }
                });

                setInterval(() => {
                    for (const candidate of getPlayerCandidates()) {
                        if (bindPlayer(candidate)) {
                            return;
                        }
                    }

                    if (bindMedia(findMediaElement())) {
                        return;
                    }

                    if (media && media.isConnected) {
                        emit('poll');
                    }
                }, 1000);
            })();
        `;

        bridgeScript.onload = () => bridgeScript.remove();
        (document.documentElement || document.head || document.body).appendChild(bridgeScript);
    }

    function handlePlayerStateEvent() {
        const detailText = document.documentElement?.getAttribute(PLAYER_STATE_ATTR);
        if (!detailText) return;

        let detail;
        try {
            detail = JSON.parse(detailText);
        } catch (error) {
            console.warn('Subtitle Ball: Failed to parse bridged player state.', error);
            return;
        }

        playerBridgeState = {
            currentTime: Number.isFinite(detail.currentTime) ? detail.currentTime : 0,
            paused: Boolean(detail.paused),
            ended: Boolean(detail.ended),
            seeking: Boolean(detail.seeking),
            reason: typeof detail.reason === 'string' ? detail.reason : ''
        };
        isBridgeActive = true;

        const currentVideo = findVideoElement();
        if (currentVideo) {
            bindVideoElement(currentVideo);
        }

        updateSubtitle();
    }

    function setupPlayerBridge() {
        document.removeEventListener(PLAYER_STATE_EVENT, handlePlayerStateEvent);
        document.addEventListener(PLAYER_STATE_EVENT, handlePlayerStateEvent);
        injectPlayerBridge();
    }

    function getCueConstructor() {
        if (typeof VTTCue !== 'undefined') return VTTCue;
        if (typeof TextTrackCue !== 'undefined') return TextTrackCue;
        return null;
    }

    function setSubtitleText(text) {
        if (!subtitleElement) return;

        const normalizedText = typeof text === 'string' ? text : '';
        if (subtitleElement.textContent !== normalizedText) {
            subtitleElement.textContent = normalizedText;
        }
        subtitleElement.style.display = normalizedText ? 'block' : 'none';
    }

    function handleTrackCueChange() {
        if (!subtitleTrack) {
            setSubtitleText('');
            return;
        }

        const activeText = Array
            .from(subtitleTrack.activeCues || [])
            .map((cue) => cue.text)
            .filter(Boolean)
            .join('\n');

        setSubtitleText(activeText);
    }

    function clearSubtitleTrack() {
        if (!subtitleTrack) return;

        try {
            subtitleTrack.removeEventListener('cuechange', handleTrackCueChange);
            Array.from(subtitleTrack.cues || []).forEach((cue) => {
                try {
                    subtitleTrack.removeCue(cue);
                } catch (error) {
                    console.warn('Subtitle Ball: Failed to remove cue.', error);
                }
            });
        } catch (error) {
            console.warn('Subtitle Ball: Failed to clear subtitle track.', error);
        }

        subtitleTrack = null;
        subtitleTrackOwner = null;
        setSubtitleText('');
    }

    function syncSubtitleTrack() {
        if (!videoElement || !subtitles.length) {
            clearSubtitleTrack();
            return false;
        }

        const CueConstructor = getCueConstructor();
        if (!CueConstructor) {
            console.warn('Subtitle Ball: VTTCue/TextTrackCue is not available, falling back to manual sync.');
            return false;
        }

        if (!subtitleTrack || subtitleTrackOwner !== videoElement) {
            clearSubtitleTrack();
            subtitleTrack = videoElement.addTextTrack('subtitles', 'Subtitle Ball', 'zh');
            subtitleTrack.mode = 'hidden';
            subtitleTrack.addEventListener('cuechange', handleTrackCueChange);
            subtitleTrackOwner = videoElement;
        } else {
            Array.from(subtitleTrack.cues || []).forEach((cue) => {
                try {
                    subtitleTrack.removeCue(cue);
                } catch (error) {
                    console.warn('Subtitle Ball: Failed to reset cue.', error);
                }
            });
        }

        subtitles.forEach((sub) => {
            const startTime = Math.max(0, sub.start);
            const endTime = Math.max(startTime + 0.01, sub.end);
            const cue = new CueConstructor(startTime, endTime, sub.text);
            subtitleTrack.addCue(cue);
        });

        subtitleTrack.mode = 'hidden';
        handleTrackCueChange();
        return true;
    }

    function findVideoElement() {
        const videos = Array.from(document.querySelectorAll('video'));
        if (videos.length === 0) return null;

        return videos
            .sort((left, right) => scoreVideoElement(right) - scoreVideoElement(left))[0] || null;
    }

    function handleVideoTimeUpdate() {
        requestAnimationFrame(updateSubtitle);
    }

    function bindVideoElement(video) {
        if (!video) return false;

        if (videoElement && videoElement !== video) {
            videoElement.removeEventListener('timeupdate', handleVideoTimeUpdate);
            videoElement.removeEventListener('seeking', handleVideoTimeUpdate);
            videoElement.removeEventListener('seeked', handleVideoTimeUpdate);
            videoElement.removeEventListener('loadedmetadata', handleVideoTimeUpdate);
        }

        if (videoElement === video) {
            return true;
        }

        videoElement = video;
        applyVideoPictureFilter();
        videoElement.addEventListener('timeupdate', handleVideoTimeUpdate);
        videoElement.addEventListener('seeking', handleVideoTimeUpdate);
        videoElement.addEventListener('seeked', handleVideoTimeUpdate);
        videoElement.addEventListener('loadedmetadata', handleVideoTimeUpdate);

        console.log('Subtitle Ball: HTML5 video element bound.', videoElement);
        requestAnimationFrame(updateSubtitle);

        if (!hasShownPlayerReadyToast) {
            hasShownPlayerReadyToast = true;
            showToast('播放器初始化完成', 1500);
        }

        return true;
    }

    /** Updates the subtitle element's vertical position style. */
    function updateSubtitlePositionStyle(positionPercent) {
        if (subtitleElement && typeof positionPercent === 'number') {
            // Ensure position is within reasonable bounds (e.g., 0% to 90%)
            const clampedPosition = Math.max(0, Math.min(90, positionPercent));
            subtitleElement.style.bottom = `${clampedPosition}%`;
        }
    }

    function updateSubtitleAppearanceStyle() {
        if (!subtitleElement) return;

        const clampedFontSize = clamp(
            Number.isFinite(subtitleFontSize) ? subtitleFontSize : 26,
            12,
            72
        );
        const normalizedColor = normalizeHexColor(subtitleColor) || '#ffffff';

        subtitleFontSize = clampedFontSize;
        subtitleColor = normalizedColor;
        subtitleElement.style.fontSize = `${clampedFontSize}px`;
        subtitleElement.style.color = normalizedColor;
    }

    /** Applies VLC-style picture adjustments (brightness/contrast/saturation) to the <video>. */
    function applyVideoPictureFilter() {
        if (!videoElement) return;
        // Only apply filter when any value deviates from default (1.0) — avoid touching
        // the site's own video styling when everything is neutral.
        const b = clamp(Number.isFinite(videoBrightness) ? videoBrightness : 1.0, 0.5, 2.0);
        const c = clamp(Number.isFinite(videoContrast) ? videoContrast : 1.0, 0.5, 2.0);
        const s = clamp(Number.isFinite(videoSaturation) ? videoSaturation : 1.0, 0, 2.0);
        videoBrightness = b; videoContrast = c; videoSaturation = s;

        if (Math.abs(b - 1.0) < 0.001 && Math.abs(c - 1.0) < 0.001 && Math.abs(s - 1.0) < 0.001) {
            videoElement.style.filter = '';
            return;
        }
        videoElement.style.filter = `brightness(${b}) contrast(${c}) saturate(${s})`;
    }

    /** Saves picture adjustments to localStorage only.
     *  Not synced to cloud — every video has different tone, user re-adjusts per video. */
    function persistVideoPictureFilter() {
        localStorage.setItem('subtitleBallVideoBrightness', videoBrightness);
        localStorage.setItem('subtitleBallVideoContrast', videoContrast);
        localStorage.setItem('subtitleBallVideoSaturate', videoSaturation);
    }

    /**
     * Creates and appends the main control panel to the page.
     */
    function createControlPanel() {
        if (document.querySelector('.custom-control-panel')) return;

        controlPanel = document.createElement('div');
        controlPanel.className = 'custom-control-panel';

        const createInputGroup = (labelText, inputType, value, onInputHandler, keyName, options = {}) => {
            const group = document.createElement('div');
            group.className = 'input-group';
            const label = document.createElement('label');
            label.textContent = labelText;
            const input = document.createElement('input');
            input.type = inputType;
            input.value = value;
            input.setAttribute('data-key-name', keyName);
            if (inputType === 'number') {
                input.min = options.min ?? ''; // Set min if provided
                input.max = options.max ?? ''; // Set max if provided
                input.step = options.step ?? 'any'; // Set step
            }
            if (inputType === 'color') {
                input.value = normalizeHexColor(value) || '#ffffff';
            }
            input.oninput = onInputHandler;
            group.append(label, input);
            return group;
        };

        // Shortcut Key Inputs
        controlPanel.append(
            createInputGroup('加速鍵', 'text', shortcutKeys.accelerate, (e) => {
                shortcutKeys.accelerate = e.target.value.toLowerCase();
            }, 'accelerate'),
            createInputGroup('快進鍵', 'text', shortcutKeys.forward, (e) => {
                shortcutKeys.forward = e.target.value.toLowerCase();
            }, 'forward'),
            createInputGroup('倒退鍵', 'text', shortcutKeys.backward, (e) => {
                shortcutKeys.backward = e.target.value.toLowerCase();
            }, 'backward')
        );

        // Playback & Subtitle Settings Inputs
        controlPanel.append(
            createInputGroup('加速倍率', 'number', accelerationRate, (e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && val > 0) accelerationRate = val;
            }, 'accelerationRate', { min: 0.1, step: 0.1 }), // Added min/step
            createInputGroup('步進秒數', 'number', skipTime, (e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && val > 0) skipTime = val;
            }, 'skipTime', { min: 0.1, step: 0.1 }), // Added min/step
            createInputGroup('字幕偏移', 'number', subtitleOffset, async (e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val)) {
                    subtitleOffset = val;
                    if (originalSubtitleText) {
                        try {
                            subtitles = await parseSRT(originalSubtitleText);
                            clearSubtitleTrack();
                            updateSubtitle();
                        } catch (error) {
                            showToast(`應用字幕偏移失敗: ${error.message}`);
                        }
                    }
                }
            }, 'subtitleOffset', { step: 0.1 }), // Added step
             // --- NEW: Subtitle Position Input ---
             createInputGroup('字幕位置', 'number', subtitleVerticalPositionPercent, (e) => {
                 const val = parseFloat(e.target.value);
                 if (!isNaN(val)) {
                     subtitleVerticalPositionPercent = val;
                     updateSubtitlePositionStyle(subtitleVerticalPositionPercent); // Update style immediately
                 }
             }, 'subtitlePosition', { min: 0, max: 90, step: 1 }), // Added min/max/step
            createInputGroup('字幕大小', 'number', subtitleFontSize, (e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val)) {
                    subtitleFontSize = clamp(val, 12, 72);
                    updateSubtitleAppearanceStyle();
                }
            }, 'subtitleSize', { min: 12, max: 72, step: 1 }),
            createInputGroup('字幕顏色', 'color', subtitleColor, (e) => {
                const nextColor = normalizeHexColor(e.target.value);
                if (nextColor) {
                    subtitleColor = nextColor;
                    updateSubtitleAppearanceStyle();
                }
            }, 'subtitleColor')
        );

        
        // --- Settings Container (collapsible) — wraps all input rows ---
        const settingsContainer = document.createElement('div');
        settingsContainer.id = 'subtitleball-settings-rows';
        settingsContainer.style.display = 'none';
        // Move the existing shortcut keys + playback inputs + lang select into settingsContainer
        // All input-group elements are currently direct children of controlPanel
        const existingGroups = controlPanel.querySelectorAll(':scope > .input-group');
        existingGroups.forEach(g => settingsContainer.appendChild(g));
        // Also move the two controlPanel.append(...) groups that were already added
        // (the shortcut keys and playback settings)
        controlPanel.appendChild(settingsContainer);

        // --- Buttons ---
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'button-group';

        const subtitleInput = document.createElement('input');
        subtitleInput.type = 'file';
        subtitleInput.accept = '.srt';
        subtitleInput.style.display = 'none';
        subtitleInput.onchange = handleLocalSubtitleFile;

        const createButton = (text, onClickHandler) => {
            const button = document.createElement('button');
            button.textContent = text;
            button.onclick = onClickHandler;
            return button;
        };

        buttonContainer.append(
            createButton('本地字幕', () => subtitleInput.click()),
            createButton('清空字幕', clearSubtitles),
            createButton('設置', toggleSettings)
        );
        buttonContainer.appendChild(subtitleInput);

        controlPanel.appendChild(buttonContainer);

        // ✕ Close button (top-right corner)
        const closeBtn = document.createElement('button');
        closeBtn.className = 'panel-close-btn';
        closeBtn.textContent = '✕';
        closeBtn.title = '關閉面板';
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            hideControlPanel();
        });
        controlPanel.appendChild(closeBtn);

        document.body.appendChild(controlPanel);
    }

    /**
     * Creates the initially hidden button to show the control panel.
     */
    function createShowControlsButton() {
        if (showControlsButton) return;

        showControlsButton = document.createElement('button');
        showControlsButton.className = 'show-controls-button';
        showControlsButton.textContent = '字幕';
        showControlsButton.style.display = 'flex';
        showControlsButton.addEventListener('pointerdown', handleFloatingButtonPointerDown);
        showControlsButton.addEventListener('click', handleFloatingButtonClick);
        document.body.appendChild(showControlsButton);
        applyFloatingButtonPosition();
    }

    /** Hides the main control panel and shows the 'Show Controls' button. */
    function hideControlPanel() {
        if (controlPanel) controlPanel.style.display = 'none';
        if (showControlsButton) showControlsButton.style.display = 'flex';
        document.removeEventListener('keydown', handlePanelEscape);
        document.removeEventListener('click', handleClickOutsidePanel, true);
    }

    /** Shows the main control panel and hides the 'Show Controls' button. */
    function showControlPanel() {
        if (controlPanel) controlPanel.style.display = 'grid';
        positionControlPanel();
        if (showControlsButton) showControlsButton.style.display = 'none';
        document.addEventListener('keydown', handlePanelEscape);
        // Add click outside listener (delay to avoid catching the toggle click)
        setTimeout(() => {
            document.addEventListener('click', handleClickOutsidePanel, true);
        }, 100);
    }

    /** ESC key handler for panel: hides panel when ESC is pressed */
    function handlePanelEscape(e) {
        if (e.key === 'Escape' && controlPanel && controlPanel.style.display !== 'none') {
            hideControlPanel();
        }
    }

    /** Click outside panel handler: hides panel when clicking outside */
    function handleClickOutsidePanel(e) {
        if (!controlPanel || controlPanel.style.display === 'none') return;
        // Don't close if clicking inside the panel
        if (controlPanel.contains(e.target)) return;
        // Don't close if clicking the floating button
        if (showControlsButton && showControlsButton.contains(e.target)) return;
        
        hideControlPanel();
    }

    /** Toggle settings rows visibility */
    function toggleSettings() {
        const container = document.getElementById('subtitleball-settings-rows');
        if (!container) return;
        
        const isHidden = container.style.display === 'none' || container.style.display === '';
        
        if (isHidden) {
            container.style.display = 'grid';
            container.style.gridTemplateColumns = 'repeat(2, minmax(0, 1fr))';
            container.style.gap = '8px 10px';
            container.style.alignItems = 'end';
            container.style.padding = '6px 0';
            container.style.gridColumn = '1 / -1';
            container.style.width = '100%';
            
            // Ensure all child .input-group have correct styling
            container.querySelectorAll(':scope > .input-group').forEach(el => {
                el.style.display = 'grid';
                el.style.gridTemplateColumns = 'minmax(0, 1fr) 56px';
                el.style.alignItems = 'center';
                el.style.gap = '6px';
                el.style.minWidth = '0';
            });
            
            // Increase panel max-height to fit settings
            if (controlPanel) {
                controlPanel.style.maxHeight = 'min(560px, calc(100vh - 80px))';
                // Allow panel to grow upward from its current position
                controlPanel.style.bottom = 'auto';
            }
            
            // Reposition panel to ensure it's fully visible
            positionControlPanel();
            
            // Add save button below settings
            const saveBtn = document.createElement('button');
            saveBtn.className = 'full-width settings-save-btn';
            saveBtn.textContent = '保存設置';
            saveBtn.onclick = saveSettings;
            container.appendChild(saveBtn);
        } else {
            container.style.display = 'none';
            // Remove save button
            const saveBtn = container.querySelector('.settings-save-btn');
            if (saveBtn) saveBtn.remove();
        }
    }

    /** Sets up the subtitle display element and attaches it to the video container. */
    function setupSubtitleDisplay() {
        subtitleElement = document.createElement('div');
        subtitleElement.className = 'custom-subtitle';
        subtitleElement.style.display = 'none'; // Hide initially
        updateSubtitlePositionStyle(subtitleVerticalPositionPercent); // Apply initial position
        updateSubtitleAppearanceStyle();

        const waitForContainer = setInterval(() => {
            videoContainer = findVideoContainer();

            if (videoContainer) {
                clearInterval(waitForContainer);
                // Ensure container can host positioned elements
                if (getComputedStyle(videoContainer).position === 'static') {
                     videoContainer.style.position = 'relative';
                }
                videoContainer.appendChild(subtitleElement);
            } else {
                console.warn("Subtitle Ball: Video container not found yet.");
            }
        }, 500);

        setTimeout(() => {
            if (!videoContainer) {
                clearInterval(waitForContainer);
                console.error("Subtitle Ball: Failed to find video container after 10 seconds.");
                showToast("錯誤：無法找到視頻容器掛載字幕", 5000);
            }
        }, 10000);
    }

    /** Handles the selection of a local SRT file. */
    async function handleLocalSubtitleFile(event) {
        const file = event.target.files[0];
        if (!file) return;
        event.target.value = null; // Reset input

        try {
            const text = await file.text();
            originalSubtitleText = text;
            subtitles = await parseSRT(text);
            clearSubtitleTrack();
            showToast('本地字幕加載成功');
        } catch (error) {
            console.error("Subtitle load error:", error);
            showToast(`本地字幕加載失敗: ${error.message}`);
            clearSubtitles();
        }
    }

    /** Parses SRT text into subtitle objects, applying the current offset. */
    async function parseSRT(text) {
        // ... (parseSRT function remains the same)
         return new Promise((resolve) => {
            const subs = text
                .replace(/\r/g, '') // Remove carriage returns
                .split(/\n\n+/) // Split into blocks
                .filter(Boolean) // Remove empty blocks
                .map(block => {
                    try {
                        const lines = block.split('\n');
                        if (lines.length < 2) return null; // Need at least time + text

                        let timeLineIndex = lines[0].includes('-->') ? 0 : (lines.length > 1 && lines[1].includes('-->') ? 1 : -1); // Allow time on line 0 or 1

                        if (timeLineIndex === -1) return null; // Invalid time line format

                        const [startStr, endStr] = lines[timeLineIndex].split(' --> ');
                        const start = parseTime(startStr) + subtitleOffset;
                        const end = parseTime(endStr) + subtitleOffset;
                        const textContent = lines.slice(timeLineIndex + 1).join('\n').trim();

                        if (isNaN(start) || isNaN(end) || start < 0 || end < 0 || start > end || !textContent) return null; // More validation

                        return { start, end, text: textContent };
                    } catch (e) {
                        console.warn("Skipping invalid SRT block:", block, e);
                        return null; // Skip malformed blocks
                    }
                })
                .filter(Boolean); // Remove any null results from map
            resolve(subs);
        });
    }

    /** Parses SRT time string (HH:MM:SS,ms) into seconds. */
    function parseTime(timeStr) {
        // ... (parseTime function remains the same)
        try {
             const [hms, msPart] = timeStr.split(/[,.]/);
             const ms = msPart ? parseInt(msPart.padEnd(3, '0').slice(0, 3), 10) : 0; // Ensure 3 digits for ms, handle missing ms
             const [h, m, s] = hms.split(':');
             const hours = parseInt(h, 10) || 0;
             const minutes = parseInt(m, 10) || 0;
             const seconds = parseInt(s, 10) || 0;

             if (isNaN(hours) || isNaN(minutes) || isNaN(seconds) || isNaN(ms)) {
                 throw new Error("Invalid time component");
             }
             return (hours * 3600) + (minutes * 60) + seconds + (ms / 1000);
         } catch (e) {
             console.error("Failed to parse time string:", timeStr, e);
             return NaN; // Return NaN on failure
         }
    }

    /** Updates the displayed subtitle based on the current video time. */
    function updateSubtitle() {
        if (!subtitleElement) return;

        if (!subtitles || subtitles.length === 0) {
            setSubtitleText('');
            return;
        }

        try {
            const currentTime = isBridgeActive
                ? playerBridgeState.currentTime
                : (videoElement ? videoElement.currentTime : NaN);

            if (!Number.isFinite(currentTime)) {
                setSubtitleText('');
                return;
            }
            // Find the first matching subtitle (handles potential overlaps)
            const currentSub = subtitles.find(sub => currentTime >= sub.start && currentTime <= sub.end);

            setSubtitleText(currentSub ? currentSub.text : '');

        } catch (e) {
            console.error("Error updating subtitle:", e);
        }
    }

    /** Initializes connection with the HTML5 video element. */
    function initPlayer() {
        let attempts = 0;

        if (playerMonitorInterval) {
            clearInterval(playerMonitorInterval);
            playerMonitorInterval = null;
        }

        const checkPlayerInterval = setInterval(() => {
            attempts += 1;
            const currentVideo = findVideoElement();

            if (currentVideo && bindVideoElement(currentVideo)) {
                clearInterval(checkPlayerInterval);
                playerMonitorInterval = setInterval(() => {
                    const refreshedVideo = findVideoElement();
                    if (!refreshedVideo) return;

                    if (!videoElement || !videoElement.isConnected || refreshedVideo !== videoElement) {
                        bindVideoElement(refreshedVideo);
                    }
                }, 1000);
                return;
            }

            if (attempts >= 30) {
                clearInterval(checkPlayerInterval);
                console.error('Subtitle Ball: Failed to find HTML5 video after 15 seconds.');
                showToast('錯誤：無法連接到播放器實例', 5000);
            }
        }, 500);
    }

    /** Sets up global keyboard shortcuts. */
    function setupShortcuts() {
        // ... (setupShortcuts function remains the same)
         document.addEventListener('keydown', (e) => {
            if (e.target.closest && e.target.closest('.custom-control-panel input')) {
                 return; // Ignore if typing in panel inputs
             }
            if (!videoElement || typeof videoElement.currentTime !== 'number') return;

            const key = e.key.toLowerCase();

            try {
                 if (key === shortcutKeys.accelerate && !isAccelerating) {
                    videoElement.playbackRate = accelerationRate;
                    isAccelerating = true;
                } else if (key === shortcutKeys.forward) {
                    videoElement.currentTime += skipTime;
                } else if (key === shortcutKeys.backward) {
                    videoElement.currentTime = Math.max(0, videoElement.currentTime - skipTime);
                }
                // VLC-style picture adjustments: w/e = brightness, r/t = contrast, y/u = saturation
                else if (key === 'w' || key === 'e') {
                    videoBrightness = clamp((videoBrightness + (key === 'e' ? 0.1 : -0.1)).toFixed(2), 0.5, 2.0);
                    applyVideoPictureFilter(); persistVideoPictureFilter();
                    showToast(`亮度 ${videoBrightness.toFixed(2)}`, 800);
                } else if (key === 'r' || key === 't') {
                    videoContrast = clamp((videoContrast + (key === 't' ? 0.1 : -0.1)).toFixed(2), 0.5, 2.0);
                    applyVideoPictureFilter(); persistVideoPictureFilter();
                    showToast(`對比度 ${videoContrast.toFixed(2)}`, 800);
                } else if (key === 'y' || key === 'u') {
                    videoSaturation = clamp((videoSaturation + (key === 'u' ? 0.1 : -0.1)).toFixed(2), 0, 2.0);
                    applyVideoPictureFilter(); persistVideoPictureFilter();
                    showToast(`飽和度 ${videoSaturation.toFixed(2)}`, 800);
                }
            } catch (err) {
                console.error("Shortcut error:", err);
             }
        });

        document.addEventListener('keyup', (e) => {
            if (e.key.toLowerCase() === shortcutKeys.accelerate && isAccelerating) {
                 if (videoElement) {
                    try { videoElement.playbackRate = 1; } catch(err) { console.error("Error resetting speed:", err); }
                 }
                isAccelerating = false;
            }
        });
    }

    /** Clears current subtitles. */
    function clearSubtitles() {
        subtitles = [];
        originalSubtitleText = '';
        clearSubtitleTrack();
        setSubtitleText('');
        showToast('字幕已清除', 1500);
    }

    /** Saves all settings to localStorage (everything stays on this device). */
    function saveSettings() {
        try {
            subtitleFontSize = clamp(
                Number.isFinite(subtitleFontSize) ? subtitleFontSize : 26,
                12,
                72
            );
            subtitleColor = normalizeHexColor(subtitleColor) || '#ffffff';
            localStorage.setItem('subtitleBallAccelerationRate', accelerationRate);
            localStorage.setItem('subtitleBallSkipTime', skipTime);
            localStorage.setItem('subtitleBallSubtitleOffset', subtitleOffset);
            localStorage.setItem('subtitleBallSubtitlePosition', subtitleVerticalPositionPercent);
            localStorage.setItem('subtitleBallSubtitleSize', subtitleFontSize);
            localStorage.setItem('subtitleBallSubtitleColor', subtitleColor);
            localStorage.setItem('subtitleBallAccelerateKey', shortcutKeys.accelerate);
            localStorage.setItem('subtitleBallForwardKey', shortcutKeys.forward);
            localStorage.setItem('subtitleBallBackwardKey', shortcutKeys.backward);
            showToast('設置已保存');
        } catch (e) {
            console.error("Error saving settings:", e);
            showToast('保存設置失敗');
        }
    }

    /** Displays a toast message — stacked so newer ones don't cover older ones. */
    function showToast(message, duration = 3000) {
        // Create a shared container for all toasts (so they stack upward, not overlap)
        let container = document.getElementById('subtitleball-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'subtitleball-toast-container';
            container.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                display: flex;
                flex-direction: column;
                gap: 8px;
                align-items: flex-end;
                z-index: 10002;
                pointer-events: none;
            `;
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.cssText = `
            background: #1a1a2e;
            color: #e8e8e8;
            padding: 10px 16px;
            border-radius: 8px;
            font-size: 13px;
            opacity: 0;
            border: 1px solid rgba(74, 158, 255, 0.15);
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
            max-width: 300px;
            text-align: center;
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
            pointer-events: none;
            transform: translateY(6px);
            transition: opacity 0.25s ease, transform 0.25s ease;
            white-space: normal;
            word-break: break-word;
            overflow-wrap: anywhere;
            overflow: visible;
            text-overflow: clip;
        `;
        container.appendChild(toast);

        // Fade in
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                toast.style.opacity = '1';
                toast.style.transform = 'translateY(0)';
            });
        });

        // Fade out & remove
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(6px)';
            setTimeout(() => {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 300);
        }, duration);
    }

    // --- Initialization ---
    function initializeScript() {
        console.log("Subtitle Ball: Initializing Safari compatibility build...");
        setupSubtitleDisplay();    // Prepare subtitle div (applies initial position)
        createControlPanel();      // Create the main controls (including position input)
        createShowControlsButton();// Create the hidden 'show' button
        hideControlPanel();        // Start collapsed to save space
        window.addEventListener('resize', handleViewportChange);
        setupPlayerBridge();       // Bridge actual page player state into Userscripts context
        setupShortcuts();          // Setup keyboard listeners
        initPlayer();              // Connect to the video element
        console.log("Subtitle Ball: Initialization complete.");
    }

    // Use MutationObserver or fallback timer to start initialization
    let initStarted = false;
    const observer = new MutationObserver((mutationsList, obs) => {
        const playerElement = findVideoElement();
        if (playerElement && !initStarted) {
             console.log("Subtitle Ball: Player element detected, running main script.");
             initStarted = true;
             obs.disconnect();
             initializeScript();
         }
    });

    observer.observe(document.documentElement || document.body, { childList: true, subtree: true });

    setTimeout(() => {
        if (!initStarted) {
             console.log("Subtitle Ball: Fallback timer triggered, attempting initialization.");
             initStarted = true; // Prevent double initialization
             observer.disconnect();
             initializeScript();
         }
     }, 4000); // Increased fallback timer slightly

})(); // End of IIFE
