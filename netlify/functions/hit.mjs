import { scansStore, EVENTS, TIME_ZONE } from '../lib/scans.mjs';

// POST {slug, event, v} from the phone page (src/track.js).
export default async (req, context) => {
  if (req.method !== 'POST') return new Response(null, { status: 405 });
  let d;
  try {
    d = JSON.parse(await req.text());
  } catch {
    return new Response(null, { status: 400 });
  }
  const ok =
    /^[a-z0-9-]{1,40}$/.test(d?.slug) && EVENTS.includes(d?.event) && /^[a-z0-9]{1,20}$/.test(d?.v);
  if (!ok) return new Response(null, { status: 400 });

  const ua = req.headers.get('user-agent') || '';
  const device = d.ipad === true || /iPhone|iPad|iPod/.test(ua) ? 'iphone' : /Android/.test(ua) ? 'android' : 'other';
  const day = new Date().toLocaleDateString('en-CA', { timeZone: TIME_ZONE }); // YYYY-MM-DD
  const key = `${day}/${d.slug}/${d.event}/${device}/${d.v}/${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
  await scansStore(context).set(key, '1');
  return new Response(null, { status: 204 });
};
