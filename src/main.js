import { Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace, TextureLoader, VideoTexture } from 'three';
import { config } from './config.js';
import { ImageTracker } from './ar.js';

const $ = (id) => document.getElementById(id);
const screens = ['screen-start', 'screen-loading', 'screen-error'];
const show = (id) => screens.forEach((s) => ($(s).hidden = s !== id));

// ---------- Errors ----------
const ERRORS = {
  inApp: {
    title: 'Open in your browser',
    body: "This app's built-in browser can't use the camera. Tap the ••• or share menu and choose “Open in Safari” or “Open in Chrome”.",
    action: 'Copy link',
  },
  insecure: {
    title: 'Secure connection needed',
    body: 'The camera only works over https. Check the link and try again.',
  },
  unsupported: {
    title: 'Browser not supported',
    body: 'Please open this page in Safari (iPhone) or Chrome (Android).',
    action: 'Copy link',
  },
  denied: {
    title: 'Camera access blocked',
    body: /iPhone|iPad|iPod/.test(navigator.userAgent)
      ? 'Tap “aA” in the address bar → Website Settings → Camera → Allow, then try again. You can also check Settings → Safari → Camera.'
      : 'Tap the icon next to the address bar → Permissions → Camera → Allow, then try again.',
    action: 'Try again',
  },
  noCamera: {
    title: 'No camera found',
    body: "We couldn't find a camera on this device. Try on your phone by scanning the QR code on the poster.",
  },
  busy: {
    title: 'Camera is busy',
    body: 'Another app is using the camera. Close it and try again.',
    action: 'Try again',
  },
  generic: {
    title: 'Something went wrong',
    body: 'Please reload the page and try again.',
    action: 'Reload',
  },
};

function showError(key, detail) {
  const e = ERRORS[key];
  if (detail) console.error(detail);
  $('error-title').textContent = e.title;
  $('error-body').textContent = e.body;
  const btn = $('btn-error');
  btn.hidden = !e.action;
  btn.textContent = e.action ?? '';
  btn.onclick = async () => {
    if (e.action === 'Copy link') {
      try {
        await navigator.clipboard.writeText(location.href);
        btn.textContent = 'Link copied';
      } catch {
        btn.textContent = location.host;
      }
    } else {
      location.reload();
    }
  };
  $('hud').hidden = true;
  show('screen-error');
}

function isInAppBrowser() {
  const ua = navigator.userAgent;
  return /FBAN|FBAV|FB_IAB|Instagram|Line\/|Snapchat|TikTok|musical_ly|BytedanceWebview|LinkedInApp|Twitter|GSA\//i.test(ua)
    || (/Android/.test(ua) && /; wv\)/.test(ua));
}

function preflight() {
  if (isInAppBrowser()) return 'inApp';
  if (!window.isSecureContext) return 'insecure';
  if (!navigator.mediaDevices?.getUserMedia) return 'unsupported';
  return null;
}

function cameraErrorKey(err) {
  switch (err?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'denied';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'noCamera';
    case 'NotReadableError':
    case 'AbortError':
      return 'busy';
    default:
      return 'generic';
  }
}

// ---------- Tuning via URL (?minCF=&beta=&miss=&warmup=) ----------
function trackingSettings() {
  const q = new URLSearchParams(location.search);
  const num = (k, fallback) => (q.has(k) && !Number.isNaN(+q.get(k)) ? +q.get(k) : fallback);
  const t = config.tracking;
  return {
    filterMinCF: num('minCF', t.filterMinCF),
    filterBeta: num('beta', t.filterBeta),
    missTolerance: num('miss', t.missTolerance),
    warmupTolerance: num('warmup', t.warmupTolerance),
  };
}

// ---------- Video ----------
const video = document.createElement('video');
video.src = config.videoSrc;
video.loop = config.loop;
video.preload = 'auto';
video.crossOrigin = 'anonymous';
video.setAttribute('playsinline', '');
video.setAttribute('webkit-playsinline', '');

function setMuted(muted) {
  video.muted = muted;
  $('ico-sound').hidden = muted;
  $('ico-muted').hidden = !muted;
  $('btn-mute').setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
}
$('btn-mute').addEventListener('click', () => setMuted(!video.muted));

// Call inside the tap: playing (even briefly) inside a user gesture is what lets
// iOS play this element with sound later, from onTargetFound.
async function unlockAudio() {
  setMuted(false);
  try {
    await video.play();
  } catch {
    // Some browsers still refuse. Fall back to muted; the mute button can unmute.
    setMuted(true);
    await video.play().catch(() => {});
  }
  if (!targetVisible) video.pause();
}

// ---------- Scene ----------
let targetVisible = false;
let revealed = false;
let fade = null; // { from, to, start, ms }

function buildContent(tracker) {
  const [w, h] = tracker.targetDimensions[0];
  const aspect = h / w;
  document.querySelector('#scan-hint .frame').style.aspectRatio = `${w} / ${h}`;
  const geo = new PlaneGeometry(1, aspect);

  const videoTex = new VideoTexture(video);
  videoTex.colorSpace = SRGBColorSpace;
  const videoMat = new MeshBasicMaterial({ map: videoTex, transparent: true, opacity: 0 });
  const videoPlane = new Mesh(geo, videoMat);

  const posterTex = new TextureLoader().load(config.posterSrc);
  posterTex.colorSpace = SRGBColorSpace;
  const posterMat = new MeshBasicMaterial({ map: posterTex, transparent: true, opacity: 1, depthWrite: false });
  const posterPlane = new Mesh(geo, posterMat);
  posterPlane.position.z = 0.001;

  const anchor = tracker.addAnchor(0);
  anchor.group.add(videoPlane, posterPlane);

  const ease = (t) => t * t * (3 - 2 * t);
  tracker.onBeforeRender = (now) => {
    if (!fade) return;
    const t = Math.min(1, (now - fade.start) / fade.ms);
    const k = ease(t);
    videoMat.opacity = fade.from + (fade.to - fade.from) * k;
    if (fade.reveal) {
      // Poster art lifts slightly and dissolves into the video.
      posterMat.opacity = 1 - k;
      posterPlane.scale.setScalar(1 + 0.06 * k);
      posterPlane.position.z = 0.001 + 0.03 * k;
    }
    if (t >= 1) {
      if (fade.reveal) posterPlane.visible = false;
      fade = null;
    }
  };

  anchor.onTargetFound = () => {
    targetVisible = true;
    $('scan-hint').classList.add('off');
    video.play().catch(() => {});
    const now = performance.now();
    if (!revealed) {
      revealed = true;
      fade = { from: 0, to: 1, start: now, ms: config.firstRevealMs, reveal: true };
    } else {
      fade = { from: 0, to: 1, start: now, ms: config.refindFadeMs };
    }
  };
  anchor.onTargetLost = () => {
    targetVisible = false;
    $('scan-hint').classList.remove('off');
    video.pause();
    if (!fade?.reveal) {
      fade = null;
      videoMat.opacity = 0;
    }
  };
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) video.pause();
  else if (targetVisible) video.play().catch(() => {});
});

// ---------- Start ----------
async function start() {
  // 1) Gesture-bound work first: audio unlock and the camera prompt.
  const audio = unlockAudio();
  const tracker = new ImageTracker({
    container: $('ar'),
    targetSrc: config.targetSrc,
    tracking: trackingSettings(),
  });
  $('loading-text').textContent = 'Starting camera…';
  show('screen-loading');
  try {
    await tracker.startCamera();
  } catch (err) {
    showError(cameraErrorKey(err), err);
    return;
  }
  await audio;

  // 2) Load the target and warm up the tracker.
  $('loading-text').textContent = 'Loading poster…';
  try {
    await tracker.startTracking();
  } catch (err) {
    showError('generic', err);
    return;
  }
  buildContent(tracker);
  if (import.meta.env.DEV) Object.assign(window, { __tracker: tracker, __video: video });

  show(null);
  $('hud').hidden = false;
}

const blocker = preflight();
if (blocker) {
  showError(blocker);
} else {
  // Warm the cache for the tracking data while the start screen is up.
  fetch(config.targetSrc).catch(() => {});
  $('btn-start').addEventListener('click', start, { once: true });
}
