// Baut data/songs.json aus data/songs-src.txt: sucht zu jedem Song die passende Deezer-ID (für Vorschau und Cover).
// Das Jahr kommt NICHT von Deezer (dort steht das Album-Jahr, bei Best-of-Alben falsch), sondern aus songs-src.txt.
// m: 1 = Song aus songs-auto.txt (Jahr von MusicBrainz).
// Aufruf: node scripts/build-songs.js   (Node 18+, braucht Internet; ca. 2–4 Minuten)
const fs = require('fs');
const path = require('path');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/ß/g, 'ss').replace(/\s*[([].*?[)\]]/g, '').replace(/\s+-\s+.*$/, '').replace(/\b(feat|ft)\..*$/, '')
  .replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();
// Versionen, die wir nicht wollen (außer der Titel in der Liste verlangt es)
const BAD = /\b(live|remix|mix\b|karaoke|instrumental|acoustic|cover|sped up|slowed|re-?recorded|demo|version 20\d\d|tribute|made famous)\b/i;

async function deezer(q) {
  for (let i = 0; i < 5; i++) {
    const r = await fetch('https://api.deezer.com/search?limit=25&q=' + encodeURIComponent(q));
    const d = await r.json();
    if (d.error && d.error.code === 4) { await sleep(5000); continue; } // Quota: 50 Anfragen / 5 s
    return d.data || [];
  }
  return [];
}

(async () => {
  // Handverlesene Liste zuerst (hat Vorrang), dann die automatisch erzeugte (scripts/build-auto.js), falls vorhanden
  const read = f => { try { return fs.readFileSync(path.join(__dirname, '..', 'data', f), 'utf8'); } catch { return ''; } };
  const src = (read('songs-src.txt') + '\n' + read('songs-auto.txt'))
    .split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'))
    .map(l => {
      const [y, a, t, extra = ''] = l.split('|').map(s => s.trim());
      const flags = extra.split(/\s+/);
      return { y: +y, a, t, de: flags.includes('de'), auto: flags.includes('auto'), dz: +(flags.find(f => f.startsWith('dz=')) || '').slice(3) || 0 };
    });
  console.log(src.length, 'Songs in der Liste');

  const out = [], missing = [];
  for (const [i, s] of src.entries()) {
    const nt = norm(s.t), na = norm(s.a);
    const okVersion = t => !BAD.test(t.title) || BAD.test(s.t);
    const titleOk = t => { const x = norm(t.title_short || t.title); return x === nt || x.startsWith(nt + ' ') || nt.startsWith(x + ' ') && x.length > 3; };
    const artistOk = t => { const x = norm(t.artist.name); return x === na || x.includes(na) || na.includes(x) && x.length > 2; };
    if (s.dz) {   // feste Deezer-ID aus der Liste
      const t = await (await fetch('https://api.deezer.com/track/' + s.dz)).json();
      if (t.id && t.readable && t.preview) out.push({ id: t.id, t: s.t, a: s.a, y: s.y, ...(s.de ? { de: 1 } : {}), ...(s.auto ? { m: 1 } : {}), c: t.md5_image || '', r: t.rank });
      else missing.push(`${s.y} | ${s.a} | ${s.t}  (dz=${s.dz} nicht abspielbar)`);
      await sleep(120);
      continue;
    }
    let res = await deezer(`artist:"${s.a}" track:"${s.t.replace(/\s*[([].*$/, '')}"`);
    let hit = res.filter(t => t.readable && t.preview && okVersion(t) && titleOk(t) && artistOk(t)).sort((a, b) => b.rank - a.rank)[0];
    if (!hit) {
      res = await deezer(`${s.a} ${s.t.replace(/\s*[([].*$/, '')}`);
      hit = res.filter(t => t.readable && t.preview && okVersion(t) && titleOk(t) && artistOk(t)).sort((a, b) => b.rank - a.rank)[0];
    }
    if (hit) out.push({ id: hit.id, t: s.t, a: s.a, y: s.y, ...(s.de ? { de: 1 } : {}), c: hit.md5_image || '', r: hit.rank });
    else missing.push(`${s.y} | ${s.a} | ${s.t}`);
    if (i % 50 === 0) console.log(i, '/', src.length);
    await sleep(120);
  }

  const seen = new Set();
  const list = out.filter(t => !seen.has(t.id) && seen.add(t.id));
  if (list.length < src.length * 0.8) { console.error(`Nur ${list.length} von ${src.length} gefunden – songs.json wird NICHT überschrieben.`); process.exit(1); }
  fs.writeFileSync(path.join(__dirname, '..', 'data', 'songs.json'),
    JSON.stringify({ built: new Date().toISOString().slice(0, 10), songs: list }));
  console.log(`Fertig: ${list.length} gefunden, ${missing.length} nicht gefunden`);
  if (missing.length) console.log('Nicht gefunden:\n  ' + missing.join('\n  '));
})();
