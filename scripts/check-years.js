// Prüft die Jahre in data/songs.json gegen MusicBrainz (gleiche Logik wie „Originaljahr nachschlagen“ in Musik-Bingo:
// früheste Veröffentlichung als Album/Single/EP, Compilations, Bootlegs und Live-Mitschnitte zählen nicht).
// - Ergebnisse landen nach jedem Song in data/mb-years.json (Deezer-ID → Jahr, 0 = nicht gefunden) – abbrechen und
//   neu starten geht jederzeit, schon Geprüftes wird übersprungen. songs.json selbst wird nicht verändert.
// - Am Ende steht in data/mb-diffs.txt, wo MusicBrainz ein anderes Jahr nennt. Die Liste prüft man von Hand und
//   korrigiert songs-src.txt, wo MusicBrainz recht hat (MusicBrainz irrt auch mal, z. B. bei falsch datierten Ausgaben).
// Aufruf: node scripts/check-years.js   (ca. 1,2 s pro neuem Song wegen des MusicBrainz-Limits)
const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, '..', 'data');
const CACHE = path.join(DATA, 'mb-years.json');
const UA = 'OlderOrNewer/1.0 ( https://github.com/Ku3rb1s/older-or-newer )';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const normStr = s => String(s || '').toLowerCase().replace(/&/g, ' and ').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}]/gu, '');
const base = s => String(s || '').replace(/\s*[([].*?[)\]]/g, '').trim();
const sameTitle = (a, b) => { const x = normStr(base(a)), y = normStr(base(b)); return x === y || normStr(a) === normStr(b); };

async function mbJson(url) {
  for (let i = 0; ; i++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    // MusicBrainz ist kurz ausgelastet → mit wachsender Pause erneut versuchen
    if ((r.status === 503 || r.status === 429) && i < 6) { await sleep(3000 * 2 ** Math.min(i, 3)); continue; }
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
}
function recYear(rec) {
  if (/^live\b/i.test(rec.disambiguation || '')) return NaN;
  const all = rec.releases || [], rels = all.filter(r => !/bootleg|pseudo|withdrawn/i.test(r.status || ''));
  if (all.length && !rels.length) return NaN;
  const earliest = list => Math.min(...list.map(r => parseInt(r.date)).filter(y => y >= 1900));
  const orig = rels.filter(r => !(r['release-group']?.['secondary-types'] || []).includes('Compilation'));
  for (const list of [orig, rels]) { const y = earliest(list); if (isFinite(y)) return y; }
  return parseInt(rec['first-release-date']);
}
async function lookup(s) {
  const artists = [s.a, s.a.split(/ & | x | feat\. /i)[0]].filter((v, k, a) => a.indexOf(v) === k);
  const q = `recording:"${base(s.t).replace(/"/g, '')}" AND (${artists.map(a => `artist:"${a.replace(/"/g, '')}"`).join(' OR ')})`;
  let best = null, upto = null;
  // Seitenweise nach immer früheren Aufnahmen suchen (bekannte Songs haben Hunderte Treffer)
  for (let page = 0; page < 3; page++) {
    const qq = upto ? `${q} AND firstreleasedate:[1900 TO ${upto}]` : q;
    const j = await mbJson('https://musicbrainz.org/ws/2/recording?fmt=json&limit=100&query=' + encodeURIComponent(qq));
    await sleep(1100);
    const before = best;
    for (const rec of j.recordings || []) {
      if ((rec.score ?? 0) < 70 || !sameTitle(rec.title, s.t)) continue;
      const credit = normStr((rec['artist-credit'] || []).map(a => a.name || a.artist?.name).join(''));
      if (!artists.some(a => credit.includes(normStr(a)))) continue;
      const y = recYear(rec);
      if (y >= 1900 && (!best || y < best)) best = y;
    }
    if ((j.count ?? 0) <= (j.recordings || []).length || !best || best === before) break;
    upto = best - 1;
  }
  return best || 0;
}

(async () => {
  const songs = JSON.parse(fs.readFileSync(path.join(DATA, 'songs.json'), 'utf8')).songs;
  let cache = {};
  try { cache = JSON.parse(fs.readFileSync(CACHE, 'utf8')); } catch {}
  const todo = songs.filter(s => !(s.id in cache));
  console.log(`${songs.length} Songs, ${songs.length - todo.length} schon geprüft, ${todo.length} offen`);
  for (const [i, s] of todo.entries()) {
    try { cache[s.id] = await lookup(s); fs.writeFileSync(CACHE, JSON.stringify(cache)); }
    catch (e) { console.log('Fehler bei', s.a, '-', s.t, e.message, '(beim nächsten Lauf erneut)'); await sleep(5000); }
    if (i % 25 === 0) console.log(i, '/', todo.length);
  }
  const diffs = [], unknown = [];
  for (const s of songs) {
    const mb = cache[s.id];
    if (mb === undefined) continue;
    if (!mb) unknown.push(`${s.y}  ${s.a} – ${s.t}`);
    else if (mb !== s.y) diffs.push(`${s.y} → MB ${mb}  (${mb < s.y ? '' : '+'}${mb - s.y})  ${s.a} – ${s.t}`);
  }
  diffs.sort((a, b) => Math.abs(+b.match(/\(([+-]?\d+)\)/)[1]) - Math.abs(+a.match(/\(([+-]?\d+)\)/)[1]));
  const report = `MusicBrainz-Abgleich ${new Date().toISOString().slice(0, 10)}\n\n${diffs.length} Abweichungen (größte zuerst):\n${diffs.join('\n')}\n\n${unknown.length} bei MusicBrainz nicht gefunden:\n${unknown.join('\n')}\n`;
  fs.writeFileSync(path.join(DATA, 'mb-diffs.txt'), report);
  console.log(`\nFertig: ${diffs.length} Abweichungen, ${unknown.length} nicht gefunden → data/mb-diffs.txt`);
})();
