// MusicBrainz: Originaljahr einer Aufnahme (gemeinsam für check-years.js und build-auto.js)
// Gleiche Regeln wie „Originaljahr nachschlagen“ in Musik-Bingo: früheste offizielle Veröffentlichung als Album, Single
// oder EP – Compilations, Live-Mitschnitte, Bootlegs und Remixe zählen nicht.
// Eine Anfrage pro Song: MusicBrainz filtert über die Suche selbst (status:official, keine Compilation/Live-Ausgaben),
// dadurch reichen 100 Treffer fast immer. Alle Anfragen laufen durch eine Warteschlange mit festem Takt
// (MusicBrainz erlaubt etwa 1 Anfrage pro Sekunde; bei „beschäftigt“ wird gewartet und neu versucht).
const UA = 'OlderOrNewer/1.0 ( https://github.com/Ku3rb1s/older-or-newer )';
const GAP = 1150;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let last = 0;

async function mbJson(url) {
  for (let i = 0; ; i++) {
    const wait = last + GAP - Date.now();
    if (wait > 0) await sleep(wait);
    last = Date.now();
    let r;
    try { r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } }); }
    catch (e) { if (i < 4) { await sleep(4000); continue; } throw e; }
    if ((r.status === 503 || r.status === 429) && i < 8) { last = Date.now() + 2500 * Math.min(i + 1, 4); continue; }
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
}

const normStr = s => String(s || '').toLowerCase().replace(/&/g, ' and ').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}]/gu, '');
// Titel ohne Zusätze wie „(Remastered 2011)“, „- Radio Edit“, „(feat. X)“
const baseTitle = s => String(s || '')
  .replace(/\s+[-–—]\s+[^-–—]*\b(remaster(ed)?|version|edit|mix|live|mono|stereo|anniversary|deluxe|single)\b[^-–—]*$/i, '')
  .replace(/\s*[([][^)\]]*\b(feat\.?|ft\.|with|remaster(ed)?|version|edit|mix|live|mono|stereo|anniversary|deluxe|from)\b[^)\]]*[)\]]/gi, '')
  .trim();
const sameTitle = (a, b) => {
  const x = normStr(baseTitle(a)), y = normStr(baseTitle(b));
  const cut = s => normStr(String(s).replace(/\s*[([].*?[)\]]/g, ''));
  return x === y || cut(a) === cut(b);
};
// Erstinterpret: „Elton John & Dua Lipa“ → [„Elton John & Dua Lipa“, „Elton John“]
const artistVariants = a => [a, a.split(/ & | x | feat\.? | with |, /i)[0]].map(s => s.trim()).filter((v, k, arr) => v && arr.indexOf(v) === k);

function recYear(rec) {
  if (/^live\b|\blive\b.*\d{4}/i.test(rec.disambiguation || '')) return NaN;
  const rels = (rec.releases || []).filter(r => !/bootleg|pseudo|withdrawn|promotion/i.test(r.status || ''));
  const orig = rels.filter(r => {
    const g = r['release-group'] || {}, sec = g['secondary-types'] || [];
    return !sec.some(t => /compilation|live|remix|dj-mix|soundtrack|interview|demo|mixtape/i.test(t));
  });
  const ys = orig.map(r => parseInt(r.date)).filter(y => y >= 1900);
  return ys.length ? Math.min(...ys) : NaN;
}

/** Originaljahr oder 0 (nicht gefunden). { year, hits } */
async function originalYear(title, artist) {
  const vs = artistVariants(artist);
  const q = `recording:"${baseTitle(title).replace(/"/g, '')}" AND (${vs.map(a => `artist:"${a.replace(/"/g, '')}"`).join(' OR ')}) AND status:official`;
  const j = await mbJson('https://musicbrainz.org/ws/2/recording?fmt=json&limit=100&query=' + encodeURIComponent(q));
  let best = 0, hits = 0;
  for (const rec of j.recordings || []) {
    if ((rec.score ?? 0) < 80 || !sameTitle(rec.title, title)) continue;
    const credit = normStr((rec['artist-credit'] || []).map(a => a.name || a.artist?.name).join(''));
    if (!vs.some(a => credit.includes(normStr(a)) || (credit.length > 2 && normStr(a).includes(credit)))) continue;
    const y = recYear(rec);
    if (!(y >= 1900)) continue;
    hits++;
    if (!best || y < best) best = y;
  }
  return { year: best, hits };
}

module.exports = { originalYear, baseTitle, normStr, mbJson };
