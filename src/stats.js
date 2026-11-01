import { posters } from './posters.js';

const $ = (id) => document.getElementById(id);
const nameOf = Object.fromEntries(posters.map((p) => [p.slug, p.name]));
const fmt = (n) => n.toLocaleString();
let password = '';
let test = false;
let day = ''; // '' = all days, else YYYY-MM-DD
let last = null; // latest response, for the CSV export
let allPhones = false;
let myPhone = ''; // this browser's id from scanning a poster on this site
try {
  password = localStorage.getItem('stats-password') || '';
  myPhone = localStorage.getItem('lp-visitor') || '';
} catch {}
const TZ = 'America/New_York';
const api = (q = {}, init = {}) =>
  fetch(`/.netlify/functions/stats?${new URLSearchParams({ ...(test && { test: '1' }), ...(day && { day }), ...q })}`, {
    ...init,
    headers: { 'x-stats-password': password, ...init.headers },
    cache: 'no-store',
  });

async function load() {
  const btn = $('refresh');
  btn.disabled = true;
  btn.textContent = 'Refreshing…';
  let done = 'Refresh';
  try {
    const res = await api();
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) return showLogin('That password is not right.');
    if (data.error === 'setup') {
      return showMessage('The dashboard password is not set yet. Add STATS_PASSWORD in Netlify (Site configuration → Environment variables), then redeploy.');
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    try {
      localStorage.setItem('stats-password', password);
    } catch {}
    render(data);
    done = 'Updated ✓';
  } catch (err) {
    showMessage(`Could not load the numbers (${err.message}). Try Refresh.`);
  } finally {
    btn.disabled = false;
    btn.textContent = done;
    // Show the tick briefly so a refresh with no new scans still looks like it worked.
    if (done !== 'Refresh') setTimeout(() => (btn.textContent = 'Refresh'), 1500);
  }
}

function showLogin(error) {
  $('dash').hidden = $('controls').hidden = $('message').hidden = true;
  $('login').hidden = false;
  $('login-error').hidden = !error;
  $('login-error').textContent = error || '';
  $('password').focus();
}

function showMessage(text) {
  $('login').hidden = true;
  $('message').hidden = false;
  $('message').textContent = text;
}

function render(data) {
  last = data;
  const { totals, posters: byPoster, days, devices } = data;
  $('login').hidden = $('message').hidden = true;
  $('dash').hidden = $('controls').hidden = false;
  $('updated').textContent = `${test ? 'Test data from preview links' : 'Live'} · ${day ? label(day) : 'all days'} · updated ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}`;
  for (const k of ['scan', 'people', 'start', 'found', 'save', 'link']) $(`t-${k}`).textContent = fmt(totals[k]);

  // Every poster, including ones nobody has scanned yet.
  const rows = [...new Set([...posters.map((p) => p.slug), ...Object.keys(byPoster)])]
    .map((slug) => ({ slug, name: nameOf[slug] || slug, ...{ scan: 0, people: 0, save: 0, link: 0 }, ...byPoster[slug] }))
    .sort((a, b) => b.scan - a.scan || a.name.localeCompare(b.name));
  const max = Math.max(1, ...rows.map((r) => r.scan));
  $('rank').innerHTML = rows
    .map(
      (r, i) => `<tr class="${r.scan ? '' : 'zero'}">
        <td>${r.scan ? i + 1 : ''}</td><td>${esc(r.name)}</td>
        <td class="bar-cell"><div class="bar" data-tip="${esc(r.name)}: ${fmt(r.scan)} scans"><span style="width:${(r.scan / max) * 100}%"></span></div></td>
        <td>${fmt(r.scan)}</td><td>${fmt(r.people)}</td><td>${fmt(r.save)}</td><td>${fmt(r.link)}</td></tr>`,
    )
    .join('');

  renderDays(days);
  renderDayPicker(days);
  renderHours(data.hours || []);
  renderPhones(data.phones || []);

  const dev = [['iPhone / iPad', devices.iphone], ['Android', devices.android], ['Other', devices.other]];
  const dmax = Math.max(1, ...dev.map((d) => d[1]));
  $('devices').innerHTML = dev
    .map(([label, n]) => `<div class="row"><span>${label}</span><div class="bar" data-tip="${label}: ${fmt(n)} people"><span style="width:${(n / dmax) * 100}%"></span></div><b>${fmt(n)}</b></div>`)
    .join('');
}

// Every day from the first scan to today, so quiet days show as gaps.
function renderDays(days) {
  const keys = Object.keys(days).sort();
  if (!keys.length) {
    $('days').outerHTML = '<div id="days" class="days-empty"><p class="empty">No scans yet.</p></div>';
    return;
  }
  const list = [];
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const end = new Date((keys.at(-1) > today ? keys.at(-1) : today) + 'T12:00:00Z');
  for (let d = new Date(keys[0] + 'T12:00:00Z'); d <= end && list.length < 120; d.setUTCDate(d.getUTCDate() + 1)) {
    const k = d.toISOString().slice(0, 10);
    list.push([k, days[k] || 0]);
  }
  const max = Math.max(1, ...list.map((d) => d[1]));
  const html = list
    .map(([k, n]) => `<div class="col${k === day ? ' on' : ''}" data-day="${k}" data-tip="${label(k)}: ${fmt(n)} scans"><span style="height:${(n / max) * 100}%"></span></div>`)
    .join('');
  $('days').outerHTML = `<div id="days"><div class="days">${html}</div><div class="day-labels"><span>${label(list[0][0])}</span><span>${label(list.at(-1)[0])}</span></div></div>`;
}

const hourLabel = (h) => `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`;
const clock = (ms) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: TZ });
const shortDate = (ms) => new Date(ms).toLocaleDateString([], { month: 'short', day: 'numeric', timeZone: TZ });

// Hours from the first to the last one with scans, so a 1-6 PM event fills the chart.
function renderHours(hours) {
  const used = hours.map((n, h) => (n ? h : -1)).filter((h) => h >= 0);
  if (!used.length) {
    $('hours').innerHTML = '<p class="empty">No scans for this view.</p>';
    return;
  }
  const from = Math.max(0, used[0] - 1);
  const to = Math.min(23, used.at(-1) + 1);
  const max = Math.max(1, ...hours);
  let cols = '';
  let labels = '';
  for (let h = from; h <= to; h++) {
    const n = hours[h];
    cols += `<div class="col" data-tip="${hourLabel(h)}–${hourLabel((h + 1) % 24)}: ${fmt(n)} scan${n === 1 ? '' : 's'}"><b>${n || ''}</b><span style="height:${(n / max) * 100}%"></span></div>`;
    labels += `<span>${hourLabel(h)}</span>`;
  }
  $('hours').innerHTML = `<div class="days hours">${cols}</div><div class="hour-labels">${labels}</div>`;
  $('hours-sub').textContent = `New York time${day ? `, ${label(day)}` : ', all days added together'}. Your hidden phones are left out.`;
}

// One row per phone. Hidden phones stay listed (greyed) so they can be shown again.
function renderPhones(phones) {
  const mine = phones.find((p) => p.id === myPhone);
  $('this-phone').hidden = !myPhone;
  if (myPhone) {
    $('this-phone').innerHTML = mine
      ? `The phone you're on now is <b>${phoneName(mine)}</b>${mine.hidden ? ' (hidden).' : '.'} <button class="ghost small" data-phone="${esc(mine.id)}" data-hide="${mine.hidden ? '' : '1'}">${mine.hidden ? 'Show it again' : 'Hide this phone'}</button>`
      : `The phone you're on now has no scans in this view.`;
  }
  const limit = 12;
  const shown = allPhones ? phones : phones.slice(0, limit);
  const multiDay = !day;
  const when = (ms) => (ms ? (multiDay ? `${shortDate(ms)}, ${clock(ms)}` : clock(ms)) : '–');
  $('phones').innerHTML = shown.length
    ? shown
        .map(
          (p) => `<tr class="${p.hidden ? 'zero' : ''}">
        <td>${phoneName(p)}${p.id === myPhone ? ' <span class="tag">this phone</span>' : ''}${p.hidden ? ' <span class="tag">hidden</span>' : ''}</td>
        <td>${when(p.first)}</td><td>${when(p.last)}</td><td>${fmt(p.scans)}</td><td>${fmt(p.posters)}</td>
        <td><button class="ghost small" data-phone="${esc(p.id)}" data-hide="${p.hidden ? '' : '1'}">${p.hidden ? 'Show' : 'Hide'}</button></td></tr>`,
        )
        .join('')
    : '<tr><td colspan="6" class="empty">No phones in this view.</td></tr>';
  $('phones-more').hidden = phones.length <= limit;
  $('phones-more').textContent = allPhones ? 'Show fewer' : `Show all ${phones.length} phones`;
}

const deviceName = { iphone: 'iPhone', android: 'Android', other: 'Other' };
const phoneName = (p) => `${deviceName[p.device] || 'Phone'} ${esc(p.id.slice(0, 4))}`;

async function setHidden(id, hide) {
  try {
    const res = await api({}, { method: 'POST', body: JSON.stringify(hide ? { hide: id } : { show: id }) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    return showMessage(`Could not change that phone (${err.message}). Try Refresh.`);
  }
  load();
}

// CSV the way spreadsheets expect: quoted where needed, BOM so Excel reads UTF-8.
function download(name, table) {
  const cell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const csv = '\ufeff' + table.map((r) => r.map(cell).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = name;
  document.body.append(a);
  a.click();
  setTimeout(() => (URL.revokeObjectURL(a.href), a.remove()), 1000);
}

const stepName = { scan: 'Scanned QR', start: 'Tapped start', found: 'Poster found', save: 'Saved video', link: 'Website tap' };
const fileTag = () => `${test ? 'test' : 'live'}-${day || 'all-days'}`;

async function exportSteps() {
  const btn = $('export-steps');
  btn.disabled = true;
  try {
    const res = await api({ rows: '1' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { rows } = await res.json();
    download(`poster-scans-${fileTag()}.csv`, [
      ['Date', 'Time (New York)', 'Poster', 'Step', 'Phone type', 'Phone', 'Hidden phone'],
      ...rows.map((r) => [r.day, r.time, nameOf[r.slug] || r.slug, stepName[r.event] || r.event, deviceName[r.device] || r.device, r.phone, r.hidden ? 'yes' : '']),
    ]);
  } catch (err) {
    showMessage(`Could not export (${err.message}). Try again.`);
  } finally {
    btn.disabled = false;
  }
}

function exportPosters() {
  if (!last) return;
  const rows = [...new Set([...posters.map((p) => p.slug), ...Object.keys(last.posters)])]
    .map((slug) => ({ name: nameOf[slug] || slug, scan: 0, people: 0, start: 0, found: 0, save: 0, link: 0, ...last.posters[slug] }))
    .sort((a, b) => b.scan - a.scan || a.name.localeCompare(b.name));
  download(`poster-summary-${fileTag()}.csv`, [
    ['Poster', 'Scans', 'People', 'Tapped start', 'Poster found', 'Videos saved', 'Website taps'],
    ...rows.map((r) => [r.name, r.scan, r.people, r.start, r.found, r.save, r.link]),
    ['Total', last.totals.scan, last.totals.people, last.totals.start, last.totals.found, last.totals.save, last.totals.link],
  ]);
}

const label = (k) => new Date(k + 'T12:00:00Z').toLocaleDateString([], { month: 'short', day: 'numeric', timeZone: 'UTC' });

// "All days" plus every day with scans, newest first.
function renderDayPicker(days) {
  const keys = [...new Set([...Object.keys(days), ...(day ? [day] : [])])].sort().reverse();
  $('day').innerHTML = ['<option value="">All days</option>', ...keys.map((k) => `<option value="${k}">${label(k)} (${fmt(days[k] || 0)})</option>`)].join('');
  $('day').value = day;
}

function setDay(next) {
  day = next;
  load();
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

// Tooltip for any element with data-tip.
const tip = $('tip');
document.addEventListener('pointermove', (e) => {
  const el = e.target.closest?.('[data-tip]');
  if (!el) return void (tip.hidden = true);
  tip.textContent = el.dataset.tip;
  tip.hidden = false;
  tip.style.left = `${Math.min(e.clientX + 12, innerWidth - tip.offsetWidth - 8)}px`;
  tip.style.top = `${e.clientY - 36}px`;
});

$('login').addEventListener('submit', (e) => {
  e.preventDefault();
  password = $('password').value;
  load();
});
$('refresh').addEventListener('click', load);
$('export-steps').addEventListener('click', exportSteps);
$('export-posters').addEventListener('click', exportPosters);
$('phones-more').addEventListener('click', () => {
  allPhones = !allPhones;
  if (last) renderPhones(last.phones || []);
});
document.addEventListener('click', (e) => {
  const b = e.target.closest?.('button[data-phone]');
  if (b) setHidden(b.dataset.phone, b.dataset.hide === '1');
});
$('day').addEventListener('change', (e) => setDay(e.target.value));
// Tap a bar to see that day; tap it again to go back to all days.
document.addEventListener('click', (e) => {
  const col = e.target.closest?.('#days .col');
  if (col) setDay(col.dataset.day === day ? '' : col.dataset.day);
});
for (const [id, value] of [['mode-live', false], ['mode-test', true]]) {
  $(id).addEventListener('click', () => {
    test = value;
    $('mode-live').setAttribute('aria-pressed', String(!test));
    $('mode-test').setAttribute('aria-pressed', String(test));
    load();
  });
}
setInterval(() => !$('dash').hidden && !document.hidden && load(), 60000);

if (password) load();
else showLogin();
