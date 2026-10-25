// Watches the camera feed for another poster's QR code, so a viewer can move
// from poster to poster without going back to the camera app.
import { posters } from './posters.js';

const EVERY_MS = 500;
// The printed QR is small (about 2 in on a 16x24 poster), so read the frame at
// close to full resolution; downscaling loses it beyond arm's length.
const MAX_SIDE = 1280;

// The poster slug a scanned QR points at, if it's one of ours.
export function slugFromQr(text) {
  let url;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (!url.hostname.includes('battle-of-the-boroughs') && url.host !== location.host) return null;
  const slug = url.pathname.split('/').filter(Boolean)[0]?.toLowerCase();
  return posters.some((p) => p.slug === slug) ? slug : null;
}

export function watchQr(video, onSlug) {
  const worker = new Worker(new URL('./qr-worker.js', import.meta.url), { type: 'module' });
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  let busy = false;
  let id = 0;

  worker.onmessage = ({ data }) => {
    busy = false;
    const slug = data.text && slugFromQr(data.text);
    if (slug) onSlug(slug);
  };
  worker.onerror = () => (busy = false);

  const timer = setInterval(() => {
    if (busy || document.hidden || video.readyState < 2 || !video.videoWidth) return;
    const k = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * k);
    canvas.height = Math.round(video.videoHeight * k);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    busy = true;
    worker.postMessage({ id: ++id, width, height, pixels: data.buffer }, [data.buffer]);
  }, EVERY_MS);

  return () => {
    clearInterval(timer);
    worker.terminate();
  };
}
