import {
  Group, Mesh, MeshBasicMaterial, PlaneGeometry, Quaternion, SRGBColorSpace, TextureLoader, Vector3, VideoTexture,
} from 'three';
import { config, currentPoster, posterFor } from './config.js';
import { ImageTracker } from './ar.js';
import { track } from './track.js';
import { watchQr } from './qr.js';

const $ = (id) => document.getElementById(id);
let poster = currentPoster();
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
  oldDevice: {
    title: 'Update needed',
    body: "This browser can't run the AR experience. Update your phone (Settings → General → Software Update), or try Chrome.",
    action: 'Copy link',
  },
  comingSoon: {
    title: 'Coming soon',
    body: 'This poster comes to life soon. Check back closer to Battle of the Boroughs.',
  },
  notFound: {
    title: 'Scan a poster',
    body: 'Scan the QR code on one of the Battle of the Boroughs posters to bring it to life.',
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
  // Show the technical reason in small print so testers can report it.
  $('error-detail').textContent = detail ? `${detail.name || 'Error'}: ${detail.message || detail}` : '';
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
  if (!document.createElement('canvas').getContext('webgl2')) return 'oldDevice';
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
if (poster) video.src = poster.videoSrc;
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
  if (!shouldPlay()) video.pause();
}

// If the browser won't play with sound (it can happen after switching posters),
// play muted rather than not at all; the mute button can turn sound back on.
function playVideo() {
  video.play().catch((err) => {
    if (err.name !== 'NotAllowedError' || video.muted) return;
    setMuted(true);
    video.play().catch(() => {});
  });
}

// ---------- Scene ----------
// The video lives in `holder`, which is posed every frame from one of three modes:
//   'tracked'  locked to the poster
//   'floating' a card in front of the camera, after the poster leaves the frame
//   'closed'   hidden after the viewer taps X, until the poster is found again
// Switching modes blends from the pose on screen to the new one, so the video
// lifts off the print and flies back onto it instead of jumping.
let targetVisible = false;
let revealed = false;
let mode = 'idle';
let fade = null; // poster -> video reveal / re-find fade: { from, to, start, ms, reveal }
let blend = null; // pose transition: { from: {p,q,s}, start, ms }
let floatTimer = null;

const shouldPlay = () => mode === 'tracked' || mode === 'floating';

function buildContent(tracker) {
  const [w, h] = tracker.targetDimensions[0];
  const aspect = h / w;
  document.querySelector('#scan-hint .frame').style.aspectRatio = `${w} / ${h}`;
  let geo = new PlaneGeometry(1, aspect);

  const videoTex = new VideoTexture(video);
  videoTex.colorSpace = SRGBColorSpace;
  const videoMat = new MeshBasicMaterial({ map: videoTex, transparent: true, opacity: 0 });
  const videoPlane = new Mesh(geo, videoMat);

  let posterTex = new TextureLoader().load(poster.posterSrc);
  posterTex.colorSpace = SRGBColorSpace;
  const posterMat = new MeshBasicMaterial({ map: posterTex, transparent: true, opacity: 1, depthWrite: false });
  const posterPlane = new Mesh(geo, posterMat);
  posterPlane.position.z = 0.001;

  const anchor = tracker.addAnchor(0);
  const holder = new Group();
  holder.visible = false;
  holder.matrixAutoUpdate = false; // posed by hand every frame
  holder.add(videoPlane, posterPlane);
  tracker.scene.add(holder);

  const tmp = { p: new Vector3(), q: new Quaternion(), s: new Vector3() };
  const target = { p: new Vector3(), q: new Quaternion(), s: new Vector3() };

  // Card pose in camera space: centred, filling most of the screen. The three.js
  // camera sits at the origin looking down -z, so this is just a point in front of it.
  function floatPose(out) {
    const cam = tracker.camera;
    const d = 1000;
    const viewH = 2 * d * Math.tan((cam.fov * Math.PI) / 360);
    const viewW = viewH * cam.aspect;
    const scale = Math.min((viewW * 0.84) / 1, (viewH * 0.7) / geo.parameters.height);
    out.p.set(0, viewH * 0.03, -d);
    out.q.identity();
    out.s.setScalar(scale);
  }

  function setMode(next) {
    if (next === mode) return;
    holder.matrix.decompose(tmp.p, tmp.q, tmp.s);
    blend = holder.visible ? { from: { p: tmp.p.clone(), q: tmp.q.clone(), s: tmp.s.clone() }, start: performance.now(), ms: next === 'tracked' ? 400 : 550 } : null;
    mode = next;
    $('btn-close').hidden = mode !== 'floating';
    $('scan-hint').classList.toggle('off', shouldPlay());
    $('switch-tip').hidden = !shouldPlay();
    $('switch-tip').classList.toggle('low', mode === 'floating');
    if (shouldPlay()) playVideo();
    else video.pause();
  }

  const ease = (t) => t * t * (3 - 2 * t);
  tracker.onBeforeRender = (now) => {
    // Pose
    if (mode === 'tracked') anchor.group.matrix.decompose(target.p, target.q, target.s);
    else floatPose(target);
    if (blend) {
      const k = ease(Math.min(1, (now - blend.start) / blend.ms));
      target.p.lerpVectors(blend.from.p, target.p, k);
      target.q.slerpQuaternions(blend.from.q, target.q, k);
      target.s.lerpVectors(blend.from.s, target.s, k);
      if (k >= 1) blend = null;
    }
    holder.matrix.compose(target.p, target.q, target.s);
    holder.matrixWorldNeedsUpdate = true;
    holder.visible = shouldPlay() || (mode === 'closed' && fade !== null);

    // Opacity
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
    clearTimeout(floatTimer);
    const wasShowing = mode === 'floating' || mode === 'tracked';
    setMode('tracked');
    track('found', poster.slug);
    const now = performance.now();
    if (!revealed) {
      revealed = true;
      fade = { from: 0, to: 1, start: now, ms: config.firstRevealMs, reveal: true };
      $('btn-save').hidden = false;
      $('site-badge').hidden = false;
    } else if (!wasShowing) {
      fade = { from: 0, to: 1, start: now, ms: config.refindFadeMs };
    }
  };
  anchor.onTargetLost = () => {
    targetVisible = false;
    // Wait a moment so a brief tracking wobble doesn't send the video flying.
    clearTimeout(floatTimer);
    floatTimer = setTimeout(() => {
      if (!targetVisible) setMode('floating');
    }, config.floatDelayMs);
  };

  $('btn-close').addEventListener('click', () => {
    if (fade?.reveal) posterPlane.visible = false;
    setMode('closed');
    fade = { from: videoMat.opacity, to: 0, start: performance.now(), ms: 250 };
  });

  mode = 'scanning';

  // Back to "point at the poster" with another poster's art and video loaded.
  return {
    reset() {
      clearTimeout(floatTimer);
      targetVisible = false;
      revealed = false;
      fade = null;
      blend = null;
      setMode('scanning');
      holder.visible = false;
      videoMat.opacity = 0;
      posterMat.opacity = 1;
      posterPlane.visible = true;
      posterPlane.scale.setScalar(1);
      posterPlane.position.z = 0.001;
      posterTex.dispose();
      posterTex = new TextureLoader().load(poster.posterSrc);
      posterTex.colorSpace = SRGBColorSpace;
      posterMat.map = posterTex;
      posterMat.needsUpdate = true;
    },
    // Call once the new target has loaded.
    fitTarget() {
      const [w, h] = tracker.targetDimensions[0];
      document.querySelector('#scan-hint .frame').style.aspectRatio = `${w} / ${h}`;
      if (Math.abs(h / w - geo.parameters.height) < 1e-4) return;
      geo.dispose();
      geo = new PlaneGeometry(1, h / w);
      videoPlane.geometry = posterPlane.geometry = geo;
    },
  };
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) video.pause();
  else if (shouldPlay()) playVideo();
});

// ---------- Save video ----------
// iOS only lets the share sheet open straight from a tap, and the HD file is too
// big to fetch inside one. So the first tap downloads it ("Preparing…") and the
// second tap opens the share sheet, where "Save Video" puts it in Photos.
let saveFile = null;
let saving = null; // the poster a download in progress is for
function resetSave() {
  saveFile = null;
  $('save-label').textContent = 'Save video';
  $('btn-save').classList.remove('ready');
  $('btn-save').disabled = false;
}
async function onSave() {
  const btn = $('btn-save');
  const label = $('save-label');
  if (saveFile) {
    try {
      if (navigator.canShare?.({ files: [saveFile] })) {
        await navigator.share({ files: [saveFile], title: `${poster.name} · ${config.event}`, text: config.shareText });
        track('save', poster.slug);
        return;
      }
    } catch (err) {
      if (err.name === 'AbortError') return; // viewer closed the share sheet
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(saveFile);
    a.download = saveFile.name;
    a.click();
    track('save', poster.slug);
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    return;
  }
  btn.disabled = true;
  const forPoster = (saving = poster);
  try {
    const res = await fetch(poster.downloadSrc);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const total = +res.headers.get('content-length') || 0;
    const reader = res.body.getReader();
    const chunks = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (saving !== forPoster) return; // switched posters mid-download
      chunks.push(value);
      got += value.length;
      label.textContent = total ? `Preparing… ${Math.round((got / total) * 100)}%` : 'Preparing…';
    }
    saveFile = new File(chunks, `${poster.slug}-battle-of-the-boroughs.mp4`, { type: 'video/mp4' });
    label.textContent = 'Tap to save';
    btn.classList.add('ready');
  } catch (err) {
    console.error(err);
    if (saving === forPoster) label.textContent = 'Try again';
  } finally {
    if (saving === forPoster) btn.disabled = false;
  }
}
$('btn-save').addEventListener('click', onSave);

// ---------- Website badge ----------
// Opens in a new tab so the AR view is still there when the viewer comes back.
$('site-badge').href = config.badge.url;
$('site-badge-label').textContent = config.badge.label;
$('site-badge').addEventListener('click', () => track('link', poster.slug));

// ---------- Switching posters ----------
// The camera keeps reading QR codes. Seeing another poster's code switches the
// page to that poster in place: same camera, same (already unlocked) video element.
let content = null;
let tracker = null;
let switching = false;
let lastQr = { slug: null, at: 0 };

async function switchPoster(slug) {
  if (switching || slug === poster.slug) return;
  const next = posterFor(slug);
  if (!next) return;
  track('scan', slug);
  if (!next.ready) {
    // Don't drop what's playing for a poster with no video yet.
    const now = Date.now();
    if (lastQr.slug !== slug || now - lastQr.at > 8000) toast(`${next.name} is coming soon`);
    lastQr = { slug, at: now };
    return;
  }
  switching = true;
  poster = next;
  history.replaceState(null, '', `/${slug}${location.search}`);
  document.title = `${poster.name} · ${config.event}`;
  $('poster-name').textContent = poster.name;
  resetSave();
  $('btn-save').hidden = true;
  $('site-badge').hidden = true;
  content.reset();
  video.pause();
  video.src = poster.videoSrc;
  video.load();
  $('scan-hint-text').textContent = `Loading ${poster.name}…`;
  try {
    await tracker.setTarget(poster.targetSrc);
    content.fitTarget();
    track('start', slug);
  } catch (err) {
    showError('generic', err);
    return;
  } finally {
    $('scan-hint-text').textContent = 'Point your camera at the poster';
    switching = false;
  }
}

let toastTimer = null;
function toast(text) {
  $('toast').textContent = text;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($('toast').hidden = true), 2500);
}

// ---------- Start ----------
async function start() {
  track('start', poster.slug);
  // 1) Gesture-bound work first: audio unlock and the camera prompt.
  const audio = unlockAudio();
  tracker = new ImageTracker({
    container: $('ar'),
    targetSrc: poster.targetSrc,
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
  content = buildContent(tracker);
  watchQr(tracker.video, (slug) => switchPoster(slug).catch((err) => showError('generic', err)));
  if (import.meta.env.DEV) Object.assign(window, { __tracker: tracker, __video: video, __switchPoster: switchPoster });

  show(null);
  $('hud').hidden = false;
}

window.__appReady = true;
const blocker = !poster ? 'notFound' : !poster.ready ? 'comingSoon' : preflight();
if (poster) track('scan', poster.slug);
if (poster) {
  $('poster-name').textContent = poster.name;
  document.title = `${poster.name} · ${config.event}`;
}
if (blocker) {
  showError(blocker);
} else {
  // Warm the cache for the tracking data while the start screen is up.
  fetch(poster.targetSrc).catch(() => {});
  const btn = $('btn-start');
  btn.textContent = 'Tap to start';
  btn.disabled = false;
  btn.addEventListener(
    'click',
    () => start().catch((err) => showError('generic', err)),
    { once: true },
  );
}
