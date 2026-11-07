/* Older or Newer – Spielablauf und Anzeige
   Prinzip wie „Higher or Lower“: Oben steht ein Song mit Jahr, unten läuft ein neuer Song. Älter oder neuer?
   Richtig → der neue Song rückt nach oben, die Serie wächst. Ein Fehler beendet das Spiel. */
const APP_VERSION = '1.5.4', APP_DATE = '07.11.2026'; // bei jedem Update erhöhen + CHANGELOG.md ergänzen
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

/* Schwierigkeit:
   gap  = Mindestabstand in Jahren zwischen zwei Songs (gleiche Jahre kommen nie vor)
   top  = nur die bekanntesten x % der Songs (nach Deezer-Rang) – große Hits sind leichter einzuordnen
   time = Sekunden Bedenkzeit pro Song (0 = unbegrenzt); läuft die Zeit ab, zählt es als Fehler */
const DIFF = {
  easy: { gap: 10, top: 0.5, time: 0 },
  normal: { gap: 5, top: 0.8, time: 0 },
  hard: { gap: 2, top: 1, time: 0 },
  pro: { gap: 1, top: 1, time: 10 },
};
const DIFF_NAMES = { easy: 'Leicht', normal: 'Normal', hard: 'Schwer', pro: 'Profi' };
const DIFF_INFO = {
  easy: 'Nur die bekanntesten Hits, mindestens 10 Jahre auseinander – zum Reinkommen.',
  normal: 'Bekannte Songs, mindestens 5 Jahre auseinander.',
  hard: 'Alle Songs, oft nur 2 oder 3 Jahre auseinander.',
  pro: 'Alle Songs, ab 1 Jahr Abstand – und nur 10 Sekunden pro Song.',
};
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
if (!DIFF[opt.diff]) opt.diff = 'normal';
if (!MODE_NAMES[opt.mode]) opt.mode = 'show';

const bestKey = () => `best2.${opt.pool}.${opt.diff}.${opt.mode}`;
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
// Spiel-Pool: Songs der Auswahl, je nach Schwierigkeit nur die bekanntesten (nach Deezer-Rang)
function gamePool() {
  const all = poolOf(opt.pool).sort((a, b) => (b.r || 0) - (a.r || 0));
  return all.slice(0, Math.max(40, Math.round(all.length * DIFF[opt.diff].top)));
}

/* ---------- Wiedergabe: 30-s-Vorschau von Deezer ----------
   Die Vorschau-Links von Deezer laufen nach einiger Zeit ab – darum wird der Link erst kurz vorher per /track/{id} geholt. */
// iPhone/iPad: audio.volume wird ignoriert (nur Gerätetasten) – dort gibt es im Spiel nur den Stumm-Knopf
if (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) document.documentElement.classList.add('ios');
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
  player.muted = opt.muted;
  player.volume = opt.vol / 100;
  $('#volBox').classList.toggle('off', opt.muted);
  const r = $('#vol');
  r.value = opt.vol; r.style.setProperty('--p', opt.vol + '%');
  $('#volVal').textContent = opt.muted ? '–' : opt.vol;
  $('#volMute use').setAttribute('href', opt.muted || !opt.vol ? '#i-mute' : '#i-vol');
}

/* ---------- Spiel ---------- */
let G = null;
function pickNext(cur) {
  const gap = DIFF[opt.diff].gap;
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
  const pool = gamePool();
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
  b.innerHTML = cardHtml(G.cur, 'known') + `<div class="vs">${tx('Ist dieser Song älter oder neuer?')}</div>` + cardHtml(G.next, 'next')
    + (DIFF[opt.diff].time ? `<div class="timebar" id="timebar"><i></i><span></span></div>` : '');
  if (fresh) b.querySelector('.song.next').classList.add('enter');
  renderPlaying();
  if (fresh) armTimer();
}

/* ---------- Bedenkzeit (Profi) ----------
   Die Uhr startet, sobald der neue Song wirklich spielt (Laden zählt nicht mit). Ohne Autoplay oder wenn das Laden
   hängt, startet sie spätestens nach 3 Sekunden. Läuft sie ab, zählt das wie ein falscher Tipp. */
let timerRaf = 0, timerFallback = 0;
function armTimer() {
  stopTimer();
  if (!DIFF[opt.diff].time || !G) return;
  G.tEnd = 0;
  drawTimer(1);
  timerFallback = setTimeout(startTimer, opt.auto ? 3000 : 600);
}
function startTimer() {
  if (!G || G.locked || G.over || G.tEnd || !DIFF[opt.diff].time) return;
  clearTimeout(timerFallback);
  const total = DIFF[opt.diff].time * 1000;
  G.tEnd = performance.now() + total;
  const step = now => {
    if (!G || G.locked || G.over) return;
    const left = G.tEnd - now;
    drawTimer(Math.max(0, left / total), left);
    if (left <= 0) return guess(null);
    timerRaf = requestAnimationFrame(step);
  };
  timerRaf = requestAnimationFrame(step);
}
function stopTimer() { cancelAnimationFrame(timerRaf); clearTimeout(timerFallback); }
function drawTimer(k, left = DIFF[opt.diff].time * 1000) {
  const tb = $('#timebar'); if (!tb) return;
  tb.querySelector('i').style.transform = `scaleX(${k})`;
  tb.querySelector('span').textContent = Math.ceil(left / 1000) + ' s';
  tb.classList.toggle('urgent', left < 3000);
}
player.addEventListener('playing', () => { if (G && playingId === G.next?.id) startTimer(); });
function renderMeta() {
  $('#streakPill').innerHTML = `<svg class="ic"><use href="#i-flame"/></svg>${tx('Serie {n}', { n: G.streak })}`;
  $('#gameBest').textContent = tx('Rekord {n}', { n: Math.max(G.best, G.streak) });
  $('#streakPill').classList.toggle('hot', G.streak > 0 && G.streak >= G.best);
}
// Knöpfe an/aus. Beim Tipp bleibt der gewählte hervorgehoben (picked); „hide“ blendet sie ganz aus (Spielende)
function setAnswer(on, picked = null, hide = false) {
  $('#answer').classList.toggle('hidden', hide);
  for (const b of [$('#btnOlder'), $('#btnNewer')]) { b.disabled = !on; b.classList.toggle('picked', b.dataset.dir === picked); }
  if (G?.cur) {
    $('#olderSub').textContent = tx('vor {y}', { y: G.cur.y });
    $('#newerSub').textContent = tx('nach {y}', { y: G.cur.y });
  }
}

async function guess(dir) {
  if (!G || G.locked || G.over) return;
  G.locked = true;
  stopTimer();
  setAnswer(false, dir);
  const { cur, next } = G;
  // dir = null: Bedenkzeit abgelaufen
  const ok = dir === 'newer' ? next.y > cur.y : dir === 'older' ? next.y < cur.y : false;
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
    : `<b class="wrong">${dir ? tx('Leider falsch') : '⏱ ' + tx('Zeit abgelaufen')}</b> ${next.y > cur.y ? tx('{d} Jahre neuer', { d: next.y - cur.y }) : tx('{d} Jahre älter', { d: cur.y - next.y })}`;
  sound(ok ? 'ok' : 'miss');
  if (!ok) {
    G.over = true; G.miss = { cur, next, dir };
    setAnswer(false, null, true);
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
/* ---------- Ergebnisbild zum Teilen (1080 × 1350, Hochformat für Story/Status) ----------
   Gezeichnet auf einem Canvas: Logo, Serie, Kästchenreihe, Zeitreise (ältester bis neuester Song), Modus und Link. */
const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
async function shareImage() {
  const W = 1080, H = 1350, n = G.streak;
  try { await document.fonts.load('900 80px Outfit'); await document.fonts.load('600 40px Outfit'); } catch {}
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const x = cv.getContext('2d');
  // Hintergrund wie das Logo: dunkel, links rot (früher), rechts grün (heute)
  let g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#1d2028'); g.addColorStop(1, '#0b0c10');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  for (const [cx, col] of [[0, 'rgba(239,68,68,.30)'], [W, 'rgba(34,197,94,.30)']]) {
    g = x.createRadialGradient(cx, H * .45, 30, cx, H * .45, 800); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
  }
  const Fo = (w, s) => `${w} ${s}px Outfit, system-ui, sans-serif`;
  const center = (t, y, font, color) => { x.font = font; x.fillStyle = color; x.textAlign = 'center'; x.fillText(t, W / 2, y); };
  try { const logo = await loadImg('icon-192.png?v=4'); x.save(); x.beginPath(); x.roundRect(W / 2 - 250, 90, 96, 96, 24); x.clip(); x.drawImage(logo, W / 2 - 250, 90, 96, 96); x.restore(); } catch {}
  x.font = Fo(900, 64); x.fillStyle = '#fff'; x.textAlign = 'left'; x.fillText('Older or Newer', W / 2 - 130, 160);
  center(modeLabel(), 262, Fo(600, 38), '#b4b8c4');
  // Große Serien-Zahl
  center(tx('Deine Serie'), 380, Fo(800, 40), '#86efac');
  g = x.createLinearGradient(0, 400, 0, 640); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#d1fae5');
  center(fmtN(n), 620, Fo(900, 260), g);
  // Kästchenreihe: grün je richtigem Tipp (bis 20), rot für den Fehler
  const cells = [...Array(Math.min(n, 20)).fill('#22c55e'), ...(G.miss ? ['#ef4444'] : [])];
  const size = cells.length > 15 ? 38 : 50, gap = 10, total = cells.length * size + Math.max(0, cells.length - 1) * gap, x0 = (W - total) / 2;
  cells.forEach((col, i) => { x.fillStyle = col; x.beginPath(); x.roundRect(x0 + i * (size + gap), 700, size, size, 11); x.fill(); });
  // Zeitreise: ältester bis neuester Song der Serie
  const ys = G.chain.map(s => s.y);
  if (ys.length > 1) center(tx('Zeitreise {a} – {b}', { a: Math.min(...ys), b: Math.max(...ys) }), 850, Fo(700, 46), '#f4f4f6');
  if (G.miss) center(`${G.miss.next.t} · ${G.miss.next.y}`, 915, Fo(500, 34), '#a1a1aa');
  x.fillStyle = 'rgba(255,255,255,.06)'; x.beginPath(); x.roundRect(120, 1080, W - 240, 150, 40); x.fill();
  x.strokeStyle = 'rgba(134,239,172,.55)'; x.lineWidth = 3; x.stroke();
  center(tx('Schaffst du mehr?'), 1145, Fo(800, 46), '#86efac');
  center('ku3rb1s.github.io/older-or-newer', 1198, Fo(600, 34), '#b4b8c4');
  return new Promise(r => cv.toBlob(r, 'image/jpeg', .9));
}
async function shareResult() {
  const text = shareText();
  let file = null;
  try { const blob = await shareImage(); if (blob) file = new File([blob], 'older-or-newer.jpg', { type: 'image/jpeg' }); } catch {}
  try {
    if (file && navigator.canShare?.({ files: [file] })) return await navigator.share({ files: [file], text });
    if (navigator.share && !file) return await navigator.share({ text });
    // Desktop ohne Bild-Teilen: Bild speichern und Text kopieren
    if (file) { const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
    await navigator.clipboard?.writeText(text);
    toast(file ? tx('Bild gespeichert, Text kopiert') : tx('Ergebnis kopiert'));
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
  const st = Sync.view('oon.stats', LS.get('stats', null)); // alle verbundenen Geräte zusammen
  if (!st?.games) { $('#statsBox').innerHTML = `<div class="group-f" style="margin-top:14px">${tx('Noch keine Spiele')}</div>`; return; }
  const rows = [
    [tx('Spiele'), fmtN(st.games)],
    [tx('Richtige Tipps'), fmtN(st.right)],
    [tx('Längste Serie'), fmtN(st.best)],
    [tx('Serie im Schnitt'), (st.right / st.games).toLocaleString(LOC(), { maximumFractionDigits: 1 })],
    [tx('Weiteste Zeitreise'), tx('{n} Jahre', { n: st.years || 0 })],
  ];
  const bests = [];
  for (const p in POOL_NAMES) for (const d in DIFF) for (const m in MODE_NAMES) {
    const v = LS.get(`best2.${p}.${d}.${m}`, 0);
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
  const colors = ['#22c55e', '#ef4444', '#facc15', '#ffffff', '#86efac'];
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
  $('#diffInfo').textContent = tx(DIFF_INFO[opt.diff]);
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
  const st = Sync.view('oon.stats', LS.get('stats', null)); // alle verbundenen Geräte zusammen
  $('#subStats').textContent = st?.games ? tx(st.games === 1 ? '{n} Spiel' : '{n} Spiele', { n: st.games }) + ' · ' + tx('Längste Serie {n}', { n: st.best }) : tx('Noch keine Spiele');
  $('#appVersion').innerHTML = `Older or Newer · ${tx('Version')} ${APP_VERSION} · ${APP_DATE}<span>${tx('Neuerungen ansehen')} ›</span>`;
  applyTheme(); applyVol();
}
function renderProfile() {
  const p = Profile.get(), s = Sync.status();
  // Abgleich zwischen Geräten (Code wird in der Jukebox angelegt) – wie in Needle Drop und Gold Record
  // „Dein Code“ (verwaltet in der Jukebox). Noch nicht gesichert? Merkt sich die Jukebox unter hub.codeSaved.
  let saved = false; try { saved = JSON.parse(localStorage.getItem('hub.codeSaved')) === s.code; } catch {}
  const unsaved = s.connected && !saved;
  $('#syncTitle').textContent = s.connected ? tx('Dein Code') : tx('Auf anderen Geräten weiterspielen');
  $('#syncSub').textContent = unsaved ? '⚠️ ' + tx('Noch nicht gesichert – in der Jukebox sichern')
    : s.connected ? tx('Code {c} · verwalten in der Jukebox', { c: s.code }) : tx('Rekorde, Serien und Profil mit einem Code mitnehmen – ohne E-Mail und Passwort');
  $('#syncIc').style.background = unsaved ? 'linear-gradient(135deg,#f59e0b,#ef4444)' : s.connected ? 'linear-gradient(135deg,#10b981,#0ea5e9)' : 'linear-gradient(135deg,#ff4f86,#fbbf24)';
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
const goHome = () => { stop(); stopTimer(); G = null; renderHome(); show('home'); };
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
  Sync.leave(); // vom persönlichen Code trennen, sonst käme beim nächsten Abgleich alles zurück
  location.reload();
};
self.liveLang = () => {
  renderHome();
  if (sheet.open) { renderSettings(); goPage($('#sheetSettings .page.active')?.dataset.page || 'main'); }
  if (G && !$('#game').classList.contains('hidden')) { renderMeta(); if (!G.locked) { renderBoard(); setAnswer(true); } }
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

// Neue Spielstände von anderen Geräten (js/sync.js, Code in der Jukebox): Startseite und offene Einstellungen neu zeichnen
addEventListener('jukebox-sync', () => { if (!G) renderHome(); if (document.querySelector('dialog[open]')) renderSettings(); });
