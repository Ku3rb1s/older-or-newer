/* Older or Newer – Spielablauf und Anzeige
   Prinzip wie „Higher or Lower“: Oben steht ein Song mit Jahr, unten läuft ein neuer Song. Älter oder neuer?
   Richtig → der neue Song rückt nach oben, die Serie wächst. Ein Fehler beendet das Spiel. */
const APP_VERSION = '1.0.0', APP_DATE = '07.11.2026'; // bei jedem Update erhöhen + CHANGELOG.md ergänzen
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

// Mindestabstand in Jahren zwischen zwei Songs – gleiche Jahre kommen nie vor
const GAPS = { easy: 8, normal: 3, hard: 1 };
const DIFF_NAMES = { easy: 'Leicht', normal: 'Normal', hard: 'Schwer' };
const POOL_NAMES = { all: 'Alle', intl: 'International', de: 'Deutsch' };
const MODE_NAMES = { show: 'Mit Titel', blind: 'Nur hören' };
const MODE_INFO = {
  show: 'Du siehst Titel und Interpret – Musikwissen hilft, das Hören auch.',
  blind: 'Nur das Hören zählt: Titel, Interpret und Cover erscheinen erst nach deinem Tipp.',
};
// Farbthemen wie in Musik-Bingo und Needle Drop
const THEMES = [['graphit', 'Graphit', '#3a4252', '#1f3a32'], ['ozean', 'Ozean', '#0b4f75', '#0d6e66'], ['wald', 'Wald', '#1d5a3a', '#4c5b1a'],
  ['abend', 'Abend', '#7a2e1c', '#7d1f4a'], ['lila', 'Lila', '#4a22a0', '#8a1458'], ['oled', 'OLED', '#000', '#000']];
const LOC = () => ({ de: 'de-DE', en: 'en-GB', fr: 'fr-FR', es: 'es-ES', nb: 'nb-NO' }[curLang] || 'de-DE');
const fmtN = n => Math.round(n).toLocaleString(LOC());
const SITE = 'https://ku3rb1s.github.io/older-or-newer/';

// Gespeichert wird mit „oon.“ vorne – alle Spiele teilen sich den Browser-Speicher von ku3rb1s.github.io
const LS = {
  get(k, d) { try { const v = localStorage.getItem('oon.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('oon.' + k, JSON.stringify(v)); } catch {} },
};
// Design gilt für alle Spiele (gleicher Schlüssel wie Needle Drop und die Jukebox-Übersicht)
const sharedTheme = {
  get() { try { return JSON.parse(localStorage.getItem('mq.theme')) || 'graphit'; } catch { return 'graphit'; } },
  set(v) { try { localStorage.setItem('mq.theme', JSON.stringify(v)); } catch {} },
};

const opt = {
  pool: LS.get('pool', 'all'), diff: LS.get('diff', 'normal'), mode: LS.get('mode', 'show'),
  auto: LS.get('auto', true), sfx: LS.get('sfx', true), vol: LS.get('vol', 80), muted: false, theme: sharedTheme.get(),
};
if (!POOL_NAMES[opt.pool]) opt.pool = 'all';
if (!GAPS[opt.diff]) opt.diff = 'normal';
if (!MODE_NAMES[opt.mode]) opt.mode = 'show';

const bestKey = () => `best.${opt.pool}.${opt.diff}.${opt.mode}`;
const modeLabel = () => [POOL_NAMES[opt.pool], DIFF_NAMES[opt.diff], MODE_NAMES[opt.mode]].map(s => tx(s)).join(' · ');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const cover = (s, size = 500) => s.c ? `https://e-cdns-images.dzcdn.net/images/cover/${s.c}/${size}x${size}-000000-80-0-0.jpg` : '';

/* ---------- Songs ---------- */
let SONGS = [];
async function loadSongs() {
  if (SONGS.length) return SONGS;
  const r = await fetch('data/songs.json?v=' + APP_VERSION);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  SONGS = (await r.json()).songs;
  return SONGS;
}
const poolOf = p => SONGS.filter(s => p === 'all' || (p === 'de' ? s.de : !s.de));

/* ---------- Wiedergabe: 30-s-Vorschau von Deezer ----------
   Die Vorschau-Links von Deezer laufen nach einiger Zeit ab – darum wird der Link erst kurz vorher per /track/{id} geholt. */
const player = new Audio();
player.preload = 'auto';
let playingId = null;
const previews = new Map();   // id → Promise<url>
function previewOf(s) {
  if (!previews.has(s.id)) {
    const p = DZ.track(s.id).then(t => {
      if (!t.preview) throw new Error(tx('Keine Vorschau'));
      if (!s.c && t.album?.md5_image) s.c = t.album.md5_image;
      return t.preview;
    });
    p.catch(() => previews.delete(s.id));   // beim nächsten Mal erneut versuchen
    previews.set(s.id, p);
  }
  return previews.get(s.id);
}
async function play(s) {
  playingId = s.id; renderPlaying();
  try {
    const url = await previewOf(s);
    if (playingId !== s.id) return;
    if (player.src !== url) player.src = url;
    applyVol();
    await player.play();
  } catch (e) {
    if (playingId === s.id) { playingId = null; renderPlaying(); }
    if (e?.name !== 'AbortError') toast(e?.name === 'NotAllowedError' ? tx('Tippe auf das Cover, um abzuspielen') : (e?.message || tx('Abspielen klappt gerade nicht')));
  }
}
function stop() { playingId = null; player.pause(); renderPlaying(); }
function toggle(s) { playingId === s.id && !player.paused ? stop() : play(s); }
player.addEventListener('ended', () => { playingId = null; renderPlaying(); });
player.addEventListener('playing', renderPlaying);
player.addEventListener('pause', renderPlaying);
function renderPlaying() {
  $$('.song').forEach(c => c.classList.toggle('playing', +c.dataset.id === playingId && !player.paused));
  $$('.song').forEach(c => c.classList.toggle('waiting', +c.dataset.id === playingId && player.paused));
}
function applyVol() {
  player.volume = opt.muted ? 0 : opt.vol / 100;
  const r = $('#vol'); if (!r) return;
  r.value = opt.vol; r.style.setProperty('--p', opt.vol + '%');
  $('#volVal').textContent = opt.muted ? '–' : opt.vol;
  $('#volMute use').setAttribute('href', opt.muted || !opt.vol ? '#i-mute' : '#i-vol');
}

/* ---------- Spiel ---------- */
let G = null;
function pickNext(cur) {
  const gap = GAPS[opt.diff];
  const free = G.pool.filter(s => !G.used.has(s.id) && s.y !== cur.y);
  // Wunsch: genug Abstand und nicht derselbe Interpret – sonst schrittweise lockerer
  const tries = [
    s => Math.abs(s.y - cur.y) >= gap && s.a !== cur.a,
    s => Math.abs(s.y - cur.y) >= gap,
    () => true,
  ];
  for (const ok of tries) {
    const c = free.filter(ok);
    if (c.length) return c[Math.floor(Math.random() * c.length)];
  }
  return null;
}

async function startGame() {
  try { await loadSongs(); } catch { return toast(tx('Die Songliste konnte nicht geladen werden.')); }
  const pool = poolOf(opt.pool);
  const first = pool[Math.floor(Math.random() * pool.length)];
  G = { pool, used: new Set([first.id]), chain: [first], streak: 0, best: LS.get(bestKey(), 0), locked: false, over: false };
  G.cur = first;
  G.next = pickNext(first); G.used.add(G.next.id);
  previewOf(G.next).catch(() => {});
  show('game');
  renderBoard(true);
  renderMeta();
  setAnswer(true);
  $('#status').textContent = '';
  if (opt.auto) play(G.next);
}

function cardHtml(s, kind) {
  const hidden = kind === 'next' && opt.mode === 'blind';
  const img = cover(s);
  return `<div class="song ${kind} ${hidden ? 'blind' : ''}" data-id="${s.id}">
    <button class="cv" aria-label="${esc(tx('Abspielen'))}">
      ${img && !hidden ? `<img src="${img}" alt="" loading="eager">` : ''}
      <span class="vinyl"></span>
      <span class="pp"><svg class="ic i-play"><use href="#i-play"/></svg><span class="eq"><i></i><i></i><i></i><i></i></span></span>
    </button>
    <div class="info">
      <div class="t">${hidden ? '? ? ?' : esc(s.t)}</div>
      <div class="a">${hidden ? tx('Hör genau hin…') : esc(s.a)}</div>
    </div>
    <div class="yr">${kind === 'known' ? s.y : '?'}</div>
  </div>`;
}
function renderBoard(fresh = false) {
  const b = $('#board');
  b.innerHTML = cardHtml(G.cur, 'known') + `<div class="vs">${tx('Ist dieser Song älter oder neuer?')}</div>` + cardHtml(G.next, 'next');
  if (fresh) b.querySelector('.song.next').classList.add('enter');
  renderPlaying();
}
function renderMeta() {
  $('#streakPill').innerHTML = `<svg class="ic"><use href="#i-flame"/></svg>${tx('Serie {n}', { n: G.streak })}`;
  $('#gameBest').textContent = tx('Rekord {n}', { n: Math.max(G.best, G.streak) });
  $('#streakPill').classList.toggle('hot', G.streak > 0 && G.streak >= G.best);
}
function setAnswer(on) {
  $('#answer').classList.toggle('hidden', !on);
  $('#btnOlder').disabled = $('#btnNewer').disabled = !on;
}

async function guess(dir) {
  if (!G || G.locked || G.over) return;
  G.locked = true;
  setAnswer(false);
  const { cur, next } = G;
  const ok = dir === 'newer' ? next.y > cur.y : next.y < cur.y;
  const card = $('#board .song.next');
  // Blind: Titel, Interpret und Cover jetzt zeigen
  if (card.classList.contains('blind')) {
    card.classList.remove('blind');
    card.querySelector('.t').textContent = next.t;
    card.querySelector('.a').textContent = next.a;
    if (cover(next)) card.querySelector('.cv').insertAdjacentHTML('afterbegin', `<img src="${cover(next)}" alt="">`);
  }
  await countYear(card.querySelector('.yr'), cur.y, next.y);
  card.classList.add(ok ? 'ok' : 'bad');
  $('#board .vs').innerHTML = ok
    ? `<b class="good">${tx('Richtig!')}</b> ${next.y > cur.y ? tx('{d} Jahre neuer', { d: next.y - cur.y }) : tx('{d} Jahre älter', { d: cur.y - next.y })}`
    : `<b class="wrong">${tx('Leider falsch')}</b> ${next.y > cur.y ? tx('{d} Jahre neuer', { d: next.y - cur.y }) : tx('{d} Jahre älter', { d: cur.y - next.y })}`;
  sound(ok ? 'ok' : 'miss');
  if (!ok) {
    G.over = true; G.miss = { cur, next, dir };
    $('#status').innerHTML = `<button class="big" id="toEnd">${tx('Zum Ergebnis')}</button>`;
    $('#toEnd').onclick = endGame;
    if (navigator.vibrate) navigator.vibrate(120);
    return;
  }
  G.streak++;
  G.chain.push(next);
  renderMeta();
  if (G.streak === G.best + 1 && G.best > 0) toast('🏆 ' + tx('Neuer Rekord!'), 1800);
  await sleep(1150);
  if (!G || G.over) return;
  const nn = pickNext(next);
  if (!nn) { G.over = true; G.allDone = true; return endGame(); }   // alle Songs geschafft
  G.used.add(nn.id);
  previewOf(nn).catch(() => {});
  // Weiterschieben: der aufgelöste Song rückt nach oben, ein neuer kommt dazu
  const b = $('#board');
  b.classList.add('shift');
  await sleep(320);
  b.classList.remove('shift');
  G.cur = next; G.next = nn;
  renderBoard(true);
  G.locked = false;
  setAnswer(true);
  if (opt.auto) play(nn); else if (playingId !== null && playingId !== G.cur.id) stop();
}

// Jahreszahl hochzählen (vom bekannten Jahr aus) – macht die Auflösung spannender
function countYear(el, from, to) {
  return new Promise(res => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = to; return res(); }
    const t0 = performance.now(), dur = Math.min(900, 250 + Math.abs(to - from) * 25);
    el.classList.add('counting');
    const step = now => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - (1 - k) ** 3;
      el.textContent = Math.round(from + (to - from) * e);
      if (k < 1) requestAnimationFrame(step); else { el.classList.remove('counting'); res(); }
    };
    requestAnimationFrame(step);
  });
}

function endGame() {
  if (!G || G.ended) return;
  G.ended = true;   // nur einmal werten (Knopf, Leertaste)
  const best = LS.get(bestKey(), 0), isBest = G.streak > best;
  if (isBest) LS.set(bestKey(), G.streak);
  recordStats(G);
  $('#endMode').textContent = modeLabel();
  $('#endScore').textContent = fmtN(G.streak);
  $('#endSub').textContent = G.allDone ? '🎉 ' + tx('Alle Songs geschafft!')
    : isBest ? '🏆 ' + tx('Neuer Rekord!') : best ? tx('Rekord {n}', { n: best }) : '';
  $('#endBest').textContent = tx('Rekord {n}', { n: Math.max(best, G.streak) });
  const m = G.miss;
  $('#endMiss').classList.toggle('hidden', !m);
  if (m) {
    const word = m.next.y > m.cur.y ? tx('neuer') : tx('älter');
    $('#endMiss').innerHTML = `<div class="miss-row"><img src="${cover(m.next, 120)}" alt=""><span><b>${esc(m.next.t)}</b> · ${esc(m.next.a)}<br>${tx('erschien {y} – also {w} als', { y: `<b>${m.next.y}</b>`, w: `<b>${word}</b>` })} <b>${esc(m.cur.t)}</b> (${m.cur.y}).</span></div>`;
  }
  const items = [...G.chain, ...(m ? [m.next] : [])];
  $('#endList').innerHTML = items.map((s, i) => `
    <div class="cell"><img class="pl-cover" src="${cover(s, 120)}" alt="">
      <span class="grow">${esc(s.t)}<span class="sub">${esc(s.a)}</span></span>
      <span class="trail ${m && i === items.length - 1 ? 'zero' : ''}">${i === 0 ? '' : m && i === items.length - 1 ? '❌ ' : '✅ '}${s.y}</span></div>`).join('');
  if (isBest && G.streak >= 3) confetti(140);
  show('end');
}

function shareText() {
  const n = G.streak;
  const row = '🟩'.repeat(Math.min(n, 20)) + (n > 20 ? '…' : '') + (G.miss ? '🟥' : '');
  return `Older or Newer 🎵 ${tx('Serie {n}', { n })} 🔥\n${modeLabel()}\n${row}\n${SITE}`;
}
async function shareResult() {
  const text = shareText();
  try {
    if (navigator.share) await navigator.share({ text });
    else { await navigator.clipboard.writeText(text); toast(tx('Ergebnis kopiert')); }
  } catch { /* abgebrochen */ }
}

/* ---------- Statistik ---------- */
function recordStats(g) {
  const st = LS.get('stats', { games: 0, right: 0, best: 0, years: 0 });
  st.games++; st.right += g.streak; st.best = Math.max(st.best, g.streak);
  // Weiteste Zeitreise in einer Serie (ältester bis neuester Song)
  const ys = g.chain.map(s => s.y);
  st.years = Math.max(st.years || 0, Math.max(...ys) - Math.min(...ys));
  LS.set('stats', st);
}
function renderStats() {
  const st = LS.get('stats', null);
  if (!st?.games) { $('#statsBox').innerHTML = `<div class="group-f" style="margin-top:14px">${tx('Noch keine Spiele')}</div>`; return; }
  const rows = [
    [tx('Spiele'), fmtN(st.games)],
    [tx('Richtige Tipps'), fmtN(st.right)],
    [tx('Längste Serie'), fmtN(st.best)],
    [tx('Serie im Schnitt'), (st.right / st.games).toLocaleString(LOC(), { maximumFractionDigits: 1 })],
    [tx('Weiteste Zeitreise'), tx('{n} Jahre', { n: st.years || 0 })],
  ];
  const bests = [];
  for (const p in POOL_NAMES) for (const d in GAPS) for (const m in MODE_NAMES) {
    const v = LS.get(`best.${p}.${d}.${m}`, 0);
    if (v) bests.push([[POOL_NAMES[p], DIFF_NAMES[d], MODE_NAMES[m]].map(s => tx(s)).join(' · '), v]);
  }
  $('#statsBox').innerHTML = `<div class="group" style="margin-top:14px">${rows.map(([k, v]) => `<div class="cell"><span class="grow">${k}</span><b>${v}</b></div>`).join('')}</div>`
    + (bests.length ? `<div class="group-h">${tx('Rekorde')}</div><div class="group">${bests.map(([k, v]) => `<div class="cell"><span class="grow">${k}</span><b>${v}</b></div>`).join('')}</div>` : '');
}

/* ---------- Töne & Konfetti ---------- */
let actx = null;
function sound(type) {
  if (!opt.sfx || opt.muted) return;
  try {
    actx ??= new (window.AudioContext || window.webkitAudioContext)();
    const notes = type === 'ok' ? [[660, 0], [990, .09]] : [[300, 0], [200, .14]];
    for (const [f, t] of notes) {
      const o = actx.createOscillator(), g = actx.createGain(), at = actx.currentTime + t;
      o.type = type === 'ok' ? 'triangle' : 'sawtooth'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(type === 'ok' ? .18 : .09, at + .015); g.gain.exponentialRampToValueAtTime(0.0001, at + .22);
      o.connect(g).connect(actx.destination); o.start(at); o.stop(at + .25);
    }
  } catch {}
}
function confetti(n = 90) {
  if (!opt.sfx || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = document.createElement('div');
  box.className = 'confetti';
  const colors = ['#22d3ee', '#a78bfa', '#fbbf24', '#ffffff', '#ff4fa3'];
  box.innerHTML = Array.from({ length: n }, () => `<i style="left:${Math.random() * 100}%;background:${colors[Math.floor(Math.random() * colors.length)]};animation-duration:${1.8 + Math.random() * 1.6}s;animation-delay:${Math.random() * .4}s;transform:rotate(${Math.random() * 360}deg)"></i>`).join('');
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 4200);
}

/* ---------- Anzeige ---------- */
function show(id) {
  for (const s of ['home', 'game', 'end']) $('#' + s).classList.toggle('hidden', s !== id);
  $('#btnQuit').classList.toggle('hidden', id !== 'game');
  window.scrollTo(0, 0);
}
function renderHome() {
  const segOn = (id, v) => $$(`#${id} button`).forEach(b => b.classList.toggle('on', b.dataset.v === v));
  segOn('setPool', opt.pool); segOn('setDiff', opt.diff); segOn('setMode', opt.mode);
  $('#modeInfo').textContent = tx(MODE_INFO[opt.mode]);
  const best = LS.get(bestKey(), 0);
  $('#bestPill').textContent = best ? '🏆 ' + tx('Rekord {n}', { n: best }) : tx('Noch kein Rekord');
  if (SONGS.length) {
    $('#nAll').textContent = tx('{n} Songs', { n: SONGS.length });
    $('#nIntl').textContent = tx('{n} Songs', { n: poolOf('intl').length });
    $('#nDe').textContent = tx('{n} Songs', { n: poolOf('de').length });
  }
}
let toastT = 0;
function toast(msg, ms = 3500) { const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('hidden'), ms); }

/* ---------- Einstellungen ---------- */
function applyTheme() {
  const th = THEMES.find(x => x[0] === opt.theme) ? opt.theme : 'graphit';
  document.documentElement.dataset.theme = th;
  $('meta[name=theme-color]').content = { graphit: '#0c0c0f', lila: '#0d0a1a', ozean: '#05111a', abend: '#130a0b', wald: '#08110c', oled: '#000000' }[th];
  $('#themeRow').innerHTML = THEMES.map(([id, name, a, b]) =>
    `<button class="theme-pick ${th === id ? 'on' : ''}" data-theme-pick="${id}"><i style="background:linear-gradient(135deg,${a},${b})"></i>${tx(name)}</button>`).join('');
}
function renderSettings() {
  $('#setAuto').checked = !!opt.auto;
  $('#setSfx').checked = !!opt.sfx;
  $('#subHelp').textContent = [opt.auto ? 'Autoplay an' : 'Autoplay aus', opt.sfx ? '' : 'Töne aus'].filter(Boolean).map(s => tx(s)).join(' · ');
  $('#subDesign').textContent = tx((THEMES.find(x => x[0] === opt.theme) || THEMES[0])[1]);
  $('#langSel').innerHTML = langOptions();
  const st = LS.get('stats', null);
  $('#subStats').textContent = st?.games ? tx(st.games === 1 ? '{n} Spiel' : '{n} Spiele', { n: st.games }) + ' · ' + tx('Längste Serie {n}', { n: st.best }) : tx('Noch keine Spiele');
  $('#appVersion').innerHTML = `Older or Newer · ${tx('Version')} ${APP_VERSION} · ${APP_DATE}<span>${tx('Neuerungen ansehen')} ›</span>`;
  applyTheme(); applyVol();
}
function renderProfile() {
  const p = Profile.get();
  $('#profEmoji').textContent = p.emoji;
  if (document.activeElement !== $('#profName')) $('#profName').value = p.name;
}
function goPage(p, back = false) {
  const page = $(`#sheetSettings .page[data-page="${p}"]`) || $('#sheetSettings .page[data-page="main"]');
  $$('#sheetSettings .page').forEach(x => x.classList.toggle('active', x === page));
  page.classList.toggle('back', back);
  $('#navTitle').textContent = page.dataset.title;
  $('#navBack').classList.toggle('invisible', page.dataset.page === 'main');
  $('#sheetSettings .sheet-body').scrollTop = 0;
  if (page.dataset.page === 'changes') renderChanges();
  if (page.dataset.page === 'stats') renderStats();
}
/* Neuerungen: CHANGELOG.md („## 1.0.0 – 07.11.2026“ + Spiegelstriche) */
let changesCache = null;
async function renderChanges() {
  const box = $('#changesList');
  if (!changesCache) {
    box.innerHTML = '<div class="cell muted"><span class="loader"></span></div>';
    try {
      const r = await fetch('CHANGELOG.md?v=' + APP_VERSION);
      if (!r.ok) throw new Error();
      changesCache = [];
      let cur = null;
      for (const line of (await r.text()).split(/\r?\n/)) {
        const hd = line.match(/^##\s+(\S+)(?:\s+[–-]\s+(.+))?$/);
        if (hd) { cur = { ver: hd[1], date: hd[2] || '', items: [] }; changesCache.push(cur); continue; }
        const li = line.match(/^\s*[-*]\s+(.*)$/);
        if (li && cur) cur.items.push(li[1]);
      }
    } catch { box.innerHTML = `<div class="cell muted">${tx('Die Neuerungen konnten nicht geladen werden.')}</div>`; return; }
  }
  const fmt = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  box.innerHTML = changesCache.map(v => `<div class="chg"><div class="chg-h"><b>${esc(v.ver)}</b>${v.ver === APP_VERSION ? `<span class="chg-now">${tx('aktuell')}</span>` : ''}<span class="chg-d">${esc(v.date)}</span></div>
    <ul>${v.items.map(i => `<li>${fmt(i)}</li>`).join('')}</ul></div>`).join('');
}

/* ---------- Ereignisse ---------- */
const segPick = (id, fn) => { $('#' + id).onclick = e => { const b = e.target.closest('button'); if (b) { fn(b.dataset.v); renderHome(); } }; };
segPick('setPool', v => { opt.pool = v; LS.set('pool', v); });
segPick('setDiff', v => { opt.diff = v; LS.set('diff', v); });
segPick('setMode', v => { opt.mode = v; LS.set('mode', v); });
$('#startBtn').onclick = startGame;
$('#againBtn').onclick = startGame;
$('#btnOlder').onclick = () => guess('older');
$('#btnNewer').onclick = () => guess('newer');
$('#board').addEventListener('click', e => {
  const c = e.target.closest('.song'); if (!c || !G) return;
  const s = [G.cur, G.next].find(x => x.id === +c.dataset.id);
  if (s) toggle(s);
});
$('#shareBtn').onclick = shareResult;
const goHome = () => { stop(); G = null; renderHome(); show('home'); };
function leave() {
  if (G && !G.over && G.streak > 0 && !$('#game').classList.contains('hidden') && !confirm(tx('Spiel beenden? Deine Serie geht verloren.'))) return;
  goHome();
}
$('#homeBtn').onclick = goHome;
$('#btnQuit').onclick = leave;
$('#logoBtn').onclick = leave;

const sheet = $('#sheetSettings');
$('#btnSettings').onclick = () => { renderSettings(); renderProfile(); goPage('main'); sheet.showModal(); };
sheet.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g) goPage(g.dataset.go); });
sheet.addEventListener('click', e => { if (e.target === sheet || e.target.closest('[data-close]')) sheet.close(); });
sheet.addEventListener('close', () => { if (!$('#home').classList.contains('hidden')) renderHome(); });
$('#navBack').onclick = () => goPage('main', true);
$('#profEmoji').onclick = () => { $('#profEmoji').textContent = Profile.nextEmoji(); };
$('#profName').oninput = () => Profile.set({ name: $('#profName').value });
$('#profName').onkeydown = e => { if (e.key === 'Enter') $('#profName').blur(); };
$('#setAuto').onchange = e => { opt.auto = e.target.checked; LS.set('auto', opt.auto); renderSettings(); };
$('#setSfx').onchange = e => { opt.sfx = e.target.checked; LS.set('sfx', opt.sfx); renderSettings(); sound('ok'); };
$('#vol').oninput = e => { opt.vol = +e.target.value; opt.muted = false; LS.set('vol', opt.vol); applyVol(); };
$('#volMute').onclick = () => { opt.muted = !opt.muted; applyVol(); };
$('#themeRow').onclick = e => {
  const b = e.target.closest('[data-theme-pick]'); if (!b) return;
  opt.theme = b.dataset.themePick; sharedTheme.set(opt.theme); renderSettings();
};
$('#langSel').onchange = e => setLang(e.target.value);
$('#btnResetAll').onclick = () => {
  if (!confirm(tx('Alles löschen, was Older or Newer auf diesem Gerät gespeichert hat?'))) return;
  try { Object.keys(localStorage).filter(k => k.startsWith('oon.')).forEach(k => localStorage.removeItem(k)); } catch {}
  location.reload();
};
self.liveLang = () => {
  renderHome();
  if (sheet.open) { renderSettings(); goPage($('#sheetSettings .page.active')?.dataset.page || 'main'); }
  if (G && !$('#game').classList.contains('hidden')) { renderMeta(); if (!G.locked) renderBoard(); }
};
document.addEventListener('keydown', e => {
  if ($('#game').classList.contains('hidden') || sheet.open || e.target.matches?.('input,select,textarea')) return;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); guess('older'); }
  else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); guess('newer'); }
  else if (e.code === 'Space') { e.preventDefault(); if (G?.over) endGame(); else if (G) toggle(G.next); }
  else if (e.key === 'm' || e.key === 'M') { opt.muted = !opt.muted; applyVol(); }
});

/* ---------- Start ---------- */
applyTheme(); applyVol(); renderHome();
loadSongs().then(renderHome).catch(() => {});
