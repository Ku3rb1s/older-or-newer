// Prüft die Jahre in data/songs.json gegen MusicBrainz (gleiche Logik wie „Originaljahr nachschlagen“ in Musik-Bingo:
// früheste Veröffentlichung als Album/Single/EP, Compilations, Bootlegs und Live-Mitschnitte zählen nicht).
// - Ergebnisse landen nach jedem Song in data/mb-years.json (Deezer-ID → Jahr, 0 = nicht gefunden) – abbrechen und
//   neu starten geht jederzeit, schon Geprüftes wird übersprungen. songs.json selbst wird nicht verändert.
// - Am Ende steht in data/mb-diffs.txt, wo MusicBrainz ein anderes Jahr nennt. Die Liste prüft man von Hand und
//   korrigiert songs-src.txt, wo MusicBrainz recht hat (MusicBrainz irrt auch mal, z. B. bei falsch datierten Ausgaben).
// Aufruf: node scripts/check-years.js   (ca. 2–3 s pro neuem Song wegen des MusicBrainz-Limits)
const fs = require('fs');
const path = require('path');
const { originalYear } = require('./mb.js');

const DATA = path.join(__dirname, '..', 'data');
const CACHE = path.join(DATA, 'mb-years.json');
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Nachschlagen: scripts/mb.js (gemeinsam mit build-auto.js)
const lookup = async s => (await originalYear(s.t, s.a)).year;

(async () => {
  const songs = JSON.parse(fs.readFileSync(path.join(DATA, 'songs.json'), 'utf8')).songs;
  let cache = {};
  try { cache = JSON.parse(fs.readFileSync(CACHE, 'utf8')); } catch {}
  const todo = songs.filter(s => !s.m && !(s.id in cache));   // Auto-Songs haben ihr Jahr schon von MusicBrainz
  console.log(`${songs.length} Songs, ${songs.length - todo.length} schon geprüft, ${todo.length} offen`);
  for (const [i, s] of todo.entries()) {
    try { cache[s.id] = await lookup(s); fs.writeFileSync(CACHE, JSON.stringify(cache)); }
    catch (e) { console.log('Fehler bei', s.a, '-', s.t, e.message, '(beim nächsten Lauf erneut)'); await sleep(5000); }
    if (i % 25 === 0) console.log(i, '/', todo.length);
  }
  const diffs = [], unknown = [];
  for (const s of songs.filter(x => !x.m)) {
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
