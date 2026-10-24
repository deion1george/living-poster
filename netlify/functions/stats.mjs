import { createHash, timingSafeEqual } from 'node:crypto';
import { scansStore, EVENTS } from '../lib/scans.mjs';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
const hash = (s) => createHash('sha256').update(String(s)).digest();

// GET with header x-stats-password. ?test=1 reads deploy-preview traffic instead.
export default async (req, context) => {
  const password = process.env.STATS_PASSWORD;
  if (!password) return json({ error: 'setup' }, 503);
  if (!timingSafeEqual(hash(req.headers.get('x-stats-password') || ''), hash(password))) {
    return json({ error: 'password' }, 401);
  }
  const test = new URL(req.url).searchParams.get('test') === '1';
  const { blobs } = await scansStore(context, test).list();

  const zero = () => Object.fromEntries(EVENTS.map((e) => [e, 0]));
  const totals = zero();
  const people = new Set();
  const byPoster = {};
  const byDay = {};
  const devices = { iphone: new Set(), android: new Set(), other: new Set() };
  for (const { key } of blobs) {
    const [day, slug, event, device, v] = key.split('/');
    if (!EVENTS.includes(event)) continue;
    totals[event]++;
    const p = (byPoster[slug] ??= { ...zero(), people: new Set() });
    p[event]++;
    if (event === 'scan') {
      people.add(v);
      p.people.add(v);
      byDay[day] = (byDay[day] || 0) + 1;
      devices[device]?.add(v);
    }
  }
  return json({
    test,
    totals: { ...totals, people: people.size },
    posters: Object.fromEntries(
      Object.entries(byPoster).map(([slug, p]) => [slug, { ...p, people: p.people.size }]),
    ),
    days: byDay,
    devices: Object.fromEntries(Object.entries(devices).map(([k, s]) => [k, s.size])),
  });
};
