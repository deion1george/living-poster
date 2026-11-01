import { createHash, timingSafeEqual } from 'node:crypto';
import { scansStore, settingsStore, EVENTS, TIME_ZONE } from '../lib/scans.mjs';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
const hash = (s) => createHash('sha256').update(String(s)).digest();
const VISITOR = /^[a-z0-9]{1,20}$/;

// Hour of day (0-23) and HH:MM:SS in the event's time zone.
const hourFmt = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, hour: 'numeric', hourCycle: 'h23' });
const timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });

// The last key part is `${Date.now()}${6 random chars}`, so every step ever
// recorded carries its exact time (to the millisecond) in the first 13 digits.
const timeOf = (unique) => {
  const ms = Number(unique?.slice(0, 13));
  return Number.isFinite(ms) && ms > 1e12 ? ms : null;
};

// GET with header x-stats-password. ?test=1 reads deploy-preview traffic instead.
// ?day=YYYY-MM-DD limits the totals to that day; the per-day chart always covers every day.
// ?rows=1 adds every step (time, poster, step, phone) for the CSV export.
// Phones on the hidden list (your own test phones) are left out of every number;
// POST {hide: id} or {show: id} edits that list. Nothing is ever deleted.
export default async (req, context) => {
  const password = process.env.STATS_PASSWORD;
  if (!password) return json({ error: 'setup' }, 503);
  if (!timingSafeEqual(hash(req.headers.get('x-stats-password') || ''), hash(password))) {
    return json({ error: 'password' }, 401);
  }
  const params = new URL(req.url).searchParams;
  const test = params.get('test') === '1';
  const settings = settingsStore();
  const hiddenKey = test ? 'hidden-phones-test' : 'hidden-phones-live';
  const hidden = new Set((await settings.get(hiddenKey, { type: 'json' })) || []);

  if (req.method === 'POST') {
    let d;
    try {
      d = JSON.parse(await req.text());
    } catch {
      return json({ error: 'bad' }, 400);
    }
    if (VISITOR.test(d?.hide)) hidden.add(d.hide);
    else if (VISITOR.test(d?.show)) hidden.delete(d.show);
    else return json({ error: 'bad' }, 400);
    await settings.setJSON(hiddenKey, [...hidden]);
    return json({ hidden: [...hidden] });
  }
  if (req.method !== 'GET') return json({ error: 'method' }, 405);

  const day = /^\d{4}-\d{2}-\d{2}$/.test(params.get('day')) ? params.get('day') : null;
  const wantRows = params.get('rows') === '1';
  const { blobs } = await scansStore(context, test).list();

  const zero = () => Object.fromEntries(EVENTS.map((e) => [e, 0]));
  const totals = zero();
  const people = new Set();
  const byPoster = {};
  const byDay = {};
  const hours = Array(24).fill(0);
  const devices = { iphone: new Set(), android: new Set(), other: new Set() };
  const phones = {};
  const rows = [];
  for (const { key } of blobs) {
    const [d, slug, event, device, v, unique] = key.split('/');
    if (!EVENTS.includes(event)) continue;
    const ts = timeOf(unique);
    const isHidden = hidden.has(v);
    if (day && d !== day) {
      if (event === 'scan' && !isHidden) byDay[d] = (byDay[d] || 0) + 1;
      continue;
    }

    // The phone list includes hidden phones so they can be shown again.
    const ph = (phones[v] ??= { id: v, device, scans: 0, steps: 0, posters: new Set(), first: null, last: null, hidden: isHidden });
    ph.steps++;
    if (ts) {
      ph.first = ph.first === null ? ts : Math.min(ph.first, ts);
      ph.last = ph.last === null ? ts : Math.max(ph.last, ts);
    }
    if (event === 'scan') {
      ph.scans++;
      ph.posters.add(slug);
    }
    if (wantRows) {
      rows.push({ day: d, time: ts ? timeFmt.format(ts) : '', ts, slug, event, device, phone: v, hidden: isHidden });
    }
    if (isHidden) continue;

    if (event === 'scan') byDay[d] = (byDay[d] || 0) + 1;
    totals[event]++;
    const p = (byPoster[slug] ??= { ...zero(), people: new Set() });
    p[event]++;
    if (event === 'scan') {
      people.add(v);
      p.people.add(v);
      devices[device]?.add(v);
      if (ts) hours[Number(hourFmt.format(ts)) % 24]++;
    }
  }
  if (wantRows) rows.sort((a, b) => (a.ts || 0) - (b.ts || 0));

  return json({
    test,
    day,
    timeZone: TIME_ZONE,
    totals: { ...totals, people: people.size },
    posters: Object.fromEntries(
      Object.entries(byPoster).map(([slug, p]) => [slug, { ...p, people: p.people.size }]),
    ),
    days: byDay,
    hours,
    devices: Object.fromEntries(Object.entries(devices).map(([k, s]) => [k, s.size])),
    phones: Object.values(phones)
      .map((p) => ({ ...p, posters: p.posters.size }))
      .sort((a, b) => b.scans - a.scans || b.steps - a.steps),
    hidden: [...hidden],
    ...(wantRows && { rows }),
  });
};
