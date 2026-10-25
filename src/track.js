// Anonymous scan counts for the dashboard (/stats). Sends the poster slug, the
// step reached and a random per-browser id (so a person scanning twice counts
// once in "people"). No names, IPs or camera data.
const EVENTS = ['scan', 'start', 'found', 'save', 'link'];

function visitorId() {
  try {
    let id = localStorage.getItem('lp-visitor');
    if (!id) {
      id = Math.random().toString(36).slice(2, 12);
      localStorage.setItem('lp-visitor', id);
    }
    return id;
  } catch {
    return 'anon';
  }
}

// iPads report themselves as Macs, so the server can't tell from the user agent.
const ipad = /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1;

const sent = new Set();
// Each step is counted at most once per poster per page load.
export function track(event, slug) {
  const key = `${slug}:${event}`;
  if (!EVENTS.includes(event) || sent.has(key) || import.meta.env.DEV) return;
  sent.add(key);
  const body = JSON.stringify({ slug, event, v: visitorId(), ...(ipad && { ipad: true }) });
  try {
    if (navigator.sendBeacon?.('/.netlify/functions/hit', body)) return;
  } catch {}
  fetch('/.netlify/functions/hit', { method: 'POST', body, keepalive: true }).catch(() => {});
}
