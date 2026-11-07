// Erweitert die Songliste automatisch: Songs aus Deezer-Redaktions-Playlists (dieselben wie in Needle Drop) und dem
// Billionärs Club, das Jahr kommt von MusicBrainz (scripts/mb.js). Nur Songs mit gefundenem Originaljahr kommen rein.
// Ergebnis: data/songs-auto.txt (gleiches Format wie songs-src.txt, mit „auto dz=…“) – danach node scripts/build-songs.js.
// Handverlesene Songs (songs-src.txt) haben Vorrang; doppelte werden übersprungen.
// MusicBrainz-Ergebnisse landen in data/mb-years.json – abbrechen und neu starten geht jederzeit.
// Aufruf: node scripts/build-auto.js   (ca. 2–3 s pro neuem Song wegen des MusicBrainz-Limits)
const fs = require('fs');
const path = require('path');
const { originalYear, baseTitle, normStr } = require('./mb.js');

const DATA = path.join(__dirname, '..', 'data');
const CACHE = path.join(DATA, 'mb-years.json');
const MIN_RANK = 300000;   // Deezer-Rang: darunter meist unbekannte Album-Tracks
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Deezer-Playlists wie in Needle Drop (js/quiz.js → CATS); de = deutschsprachig
const PLAYLISTS = [
  [1470022445], [8496467462], [867825522], [878989033], [3829647662], [1977689462], [11153531204], [14917741483], [13650084141], // Jahrzehnte
  [1282483245], [8282573142], [3366148622], [7662551722], [12547421383], [11472627304], [2021626162], [11242423484], [1306931615], // Pop, Rap, R&B, Rock
  [14429104921], [11600724204], [6237312204], [11340708804], [789123393], [1111143121], [3155776842], // EDM, Latin, aktuell
  [10578289242, 'de'], [146820791, 'de'], [11242422704, 'de'], [8699026122, 'de'], [7947319822, 'de'], [12244014291, 'de'], [6758361584, 'de'], // Deutsch
];
const BILLIONS = 'https://ku3rb1s.github.io/needle-drop/data/billions.json';
// Versionen, die wir nicht wollen
const BAD = /\b(live|remix|karaoke|instrumental|acoustic|cover|sped up|slowed|re-?recorded|demo|tribute|made famous|medley|mashup|version 20\d\d|taylor's version)\b/i;
// Deutschsprachige Acts aus den internationalen Listen erkennen wir nicht automatisch – nur über die Playlist

async function dz(url) {
  for (let i = 0; i < 6; i++) {
    const d = await (await fetch('https://api.deezer.com' + url)).json();
    if (d.error?.code === 4) { await sleep(5000); continue; }   // Quota: 50 Anfragen / 5 s
    return d;
  }
  return {};
}
async function playlist(id) {
  const out = [];
  for (let index = 0; index < 1000; index += 100) {
    const d = await dz(`/playlist/${id}/tracks?limit=100&index=${index}`);
    out.push(...(d.data || []));
    await sleep(120);
    if (!d.next) break;
  }
  return out;
}
const key = (t, a) => normStr(baseTitle(t)) + '|' + normStr(String(a).split(/ & | x | feat\.? | with |, /i)[0]);
const cleanTitle = t => baseTitle(t.title_short || t.title).replace(/\s+[-–—]\s+.*\b(remaster(ed)?|version|edit)\b.*$/i, '').trim();

(async () => {
  // schon vorhanden: handverlesene Liste
  const curated = fs.readFileSync(path.join(DATA, 'songs-src.txt'), 'utf8').split(/\r?\n/)
    .filter(l => /^\d{4}\s*\|/.test(l)).map(l => l.split('|').map(s => s.trim()));
  const have = new Set(curated.map(([, a, t]) => key(t, a)));
  const haveIds = new Set(curated.map(c => (c[3] || '').match(/dz=(\d+)/)?.[1]).filter(Boolean).map(Number));
  try { for (const s of JSON.parse(fs.readFileSync(path.join(DATA, 'songs.json'), 'utf8')).songs) haveIds.add(s.id); } catch {}

  // Kandidaten sammeln
  const cand = new Map();   // key → { id, t, a, r, de }
  const add = (t, de) => {
    if (!t?.id || !t.readable || !t.preview || (t.rank || 0) < MIN_RANK || BAD.test(t.title) || haveIds.has(t.id)) return;
    const a = t.artist?.name, ti = cleanTitle(t), k = key(ti, a);
    if (!a || !ti || have.has(k)) return;
    const old = cand.get(k);
    if (!old || t.rank > old.r) cand.set(k, { id: t.id, t: ti, a, r: t.rank, de: de || old?.de });
  };
  for (const [id, de] of PLAYLISTS) {
    const tracks = await playlist(id);
    tracks.forEach(t => add(t, de === 'de'));
    console.log(`Playlist ${id}: ${tracks.length} Titel → ${cand.size} Kandidaten`);
  }
  try {
    const b = await (await fetch(BILLIONS)).json();
    for (const t of b.tracks) add({ id: t.id, title: t.title, artist: { name: t.artist }, readable: true, preview: true, rank: 900000 });
    console.log(`Billionärs Club: ${b.tracks.length} → ${cand.size} Kandidaten`);
  } catch (e) { console.log('Billionärs Club nicht geladen:', e.message); }

  // Jahr bei MusicBrainz nachschlagen (bekannteste zuerst)
  let cache = {};
  try { cache = JSON.parse(fs.readFileSync(CACHE, 'utf8')); } catch {}
  const list = [...cand.values()].sort((x, y) => y.r - x.r);
  const todo = list.filter(c => !(c.id in cache));
  console.log(`${list.length} Kandidaten, ${todo.length} noch bei MusicBrainz nachzuschlagen`);
  const write = () => {
    const lines = list.filter(c => cache[c.id] >= 1950 && cache[c.id] <= 2026)
      .sort((x, y) => cache[x.id] - cache[y.id] || x.a.localeCompare(y.a))
      .map(c => `${cache[c.id]} | ${c.a.replace(/\|/g, '/')} | ${c.t.replace(/\|/g, '/')} | auto dz=${c.id}${c.de ? ' de' : ''}`);
    fs.writeFileSync(path.join(DATA, 'songs-auto.txt'),
      `# Automatisch erzeugt von scripts/build-auto.js – nicht von Hand bearbeiten (Korrekturen in songs-src.txt eintragen,\n# dort haben sie Vorrang). Jahr = Originaljahr laut MusicBrainz.\n${lines.join('\n')}\n`);
    return lines.length;
  };
  for (const [i, c] of todo.entries()) {
    try { cache[c.id] = (await originalYear(c.t, c.a)).year; fs.writeFileSync(CACHE, JSON.stringify(cache)); }
    catch (e) { console.log('Fehler bei', c.a, '-', c.t, e.message); }
    if (i % 50 === 0) console.log(i, '/', todo.length, '→', write(), 'Songs mit Jahr');
  }
  console.log(`Fertig: ${write()} Songs mit Originaljahr in data/songs-auto.txt`);
})();
