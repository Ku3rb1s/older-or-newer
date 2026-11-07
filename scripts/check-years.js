// Prüft die Jahre in data/songs.json gegen MusicBrainz (gleiche Logik wie „Originaljahr nachschlagen“ in Musik-Bingo:
// früheste Veröffentlichung als Album/Single/EP, Compilations, Bootlegs und Live-Mitschnitte zählen nicht).
// Schreibt das MusicBrainz-Jahr als „mb“ in songs.json und listet Abweichungen auf – die Liste prüft man dann von Hand
// und korrigiert songs-src.txt, wo MusicBrainz recht hat.
// Aufruf: node scripts/check-years.js   (ca. 1,2 s pro Song wegen des MusicBrainz-Limits)
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'songs.json');
const UA = 'OlderOrNewer/1.0 ( https://github.com/Ku3rb1s/older-or-newer )';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const normStr = s => String(s || '').toLowerCase().replace(/&/g, ' and ').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}]/gu, '');
const base = s => String(s || '').replace(/\s*[([].*?[)\]]/g, '').trim();
const sameTitle = (a, b) => { const x = normStr(base(a)), y = normStr(base(b)); return x === y || normStr(a) === normStr(b); };

async function mbJson(url) {
  for (let i = 0; ; i++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if ((r.status === 503 || r.status === 429) && i < 4) { await sleep(2000 * 2 ** i); continue; }
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

(async () => {
  const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const diffs = [];
  for (const [i, s] of data.songs.entries()) {
    const artists = [s.a, s.a.split(/ & | x | feat\. /i)[0]].filter((v, k, a) => a.indexOf(v) === k);
    const q = `recording:"${base(s.t).replace(/"/g, '')}" AND (${artists.map(a => `artist:"${a.replace(/"/g, '')}"`).join(' OR ')})`;
    let best = null;
    try {
      // Seitenweise nach immer früheren Aufnahmen suchen (bekannte Songs haben Hunderte Treffer)
      let upto = null;
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
    } catch (e) { console.log('Fehler bei', s.a, '-', s.t, e.message); }
    s.mb = best || 0;
    if (best && best !== s.y) diffs.push(`${s.y} → MB ${best}  ${s.a} – ${s.t}`);
    if (!best) diffs.push(`${s.y} → MB ?     ${s.a} – ${s.t}`);
    if (i % 25 === 0) console.log(i, '/', data.songs.length);
  }
  fs.writeFileSync(FILE, JSON.stringify(data));
  console.log(`\n${diffs.length} Abweichungen:\n` + diffs.join('\n'));
})();
