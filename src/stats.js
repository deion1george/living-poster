import { posters } from './posters.js';

const $ = (id) => document.getElementById(id);
const nameOf = Object.fromEntries(posters.map((p) => [p.slug, p.name]));
const fmt = (n) => n.toLocaleString();
let password = '';
let test = false;
try {
  password = localStorage.getItem('stats-password') || '';
} catch {}

async function load() {
  const btn = $('refresh');
  btn.disabled = true;
  btn.textContent = 'Refreshing…';
  let done = 'Refresh';
  try {
    const res = await fetch(`/.netlify/functions/stats${test ? '?test=1' : ''}`, {
      headers: { 'x-stats-password': password },
      cache: 'no-store',
    });
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

function render({ totals, posters: byPoster, days, devices }) {
  $('login').hidden = $('message').hidden = true;
  $('dash').hidden = $('controls').hidden = false;
  $('updated').textContent = `${test ? 'Test data from preview links' : 'Live'} · updated ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}`;
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
  const label = (k) => new Date(k + 'T12:00:00Z').toLocaleDateString([], { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const html = list
    .map(([k, n]) => `<div class="col" data-tip="${label(k)}: ${fmt(n)} scans"><span style="height:${(n / max) * 100}%"></span></div>`)
    .join('');
  $('days').outerHTML = `<div id="days"><div class="days">${html}</div><div class="day-labels"><span>${label(list[0][0])}</span><span>${label(list.at(-1)[0])}</span></div></div>`;
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
