// Prüft die Sprachdateien (js/lang/*.js): Was fehlt, was ist überflüssig, stimmen die Platzhalter?
// Aufruf im Projektordner:  node scripts/check-lang.js          (Prüfen)
//                           node scripts/check-lang.js --keys   (alle zu übersetzenden deutschen Texte als JSON ausgeben)
// Gesammelt werden: feste Texte in index.html, tx('…')-Texte im Code und übersetzte Datenfelder (Kategorien usw.).
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');

/* ---------- alle deutschen Texte sammeln ---------- */
const keys = new Set();
const add = s => { s = s.replace(/\s+/g, ' ').trim(); if (s && /\p{L}/u.test(s)) keys.add(s); };
const unq = s => s.replace(/\\n/g, '\n').replace(/\\'/g, "'").replace(/\\"/g, '"');

// 1) index.html: Text zwischen Tags (ohne <script>, <style>, <svg>, data-no-tx) und Attribute
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
  .replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<svg[\s\S]*?<\/svg>/g, '')
  .replace(/<!--[\s\S]*?-->/g, '');
const decode = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ');
const body = html.slice(html.indexOf('<body'));
for (const m of body.matchAll(/>([^<>]+)</g)) add(decode(m[1]));
for (const m of body.matchAll(/\s(?:placeholder|aria-label|title|data-title)="([^"]+)"/g)) add(decode(m[1]));
['Older or Newer', 'M', '1985', '?'].forEach(k => keys.delete(k)); // Eigennamen/Tasten

// 2) Code: alle Text-Literale innerhalb von tx( … ) – auch in Ternären und Objekt-Tabellen
const code = fs.readdirSync(path.join(root, 'js')).filter(f => f.endsWith('.js') && f !== 'i18n.js')
  .map(f => fs.readFileSync(path.join(root, 'js', f), 'utf8')).join('\n');
for (const m of code.matchAll(/\btx\(/g)) {
  // bis zur passenden schließenden Klammer
  let i = m.index + 3, depth = 1, j = i;
  while (j < code.length && depth) { const c = code[j]; if (c === '(') depth++; else if (c === ')') depth--; else if (c === "'" || c === '"' || c === '`') { const q = c; j++; while (j < code.length && code[j] !== q) { if (code[j] === '\\') j++; j++; } } j++; }
  const arg = code.slice(i, j - 1).split(/,\s*\{[^']*$/)[0];
  for (const s of arg.matchAll(/'((?:\\.|[^'\\])*)'/g)) add(unq(s[1]));
}
// 3) Tabellen, deren Texte über tx(Variable) laufen: Namen der Songs/Schwierigkeiten/Modi, Modus-Infos, Farbthemen
for (const tbl of ['POOL_NAMES', 'DIFF_NAMES', 'MODE_NAMES', 'MODE_INFO']) {
  const m = code.match(new RegExp('const ' + tbl + ' = \\{([\\s\\S]*?)\\};'));
  if (m) for (const s of m[1].matchAll(/:\s*'((?:\\.|[^'\\])*)'/g)) add(unq(s[1]));
}
for (const m of code.matchAll(/\['(?:graphit|ozean|wald|abend|lila|oled)', '([^']+)'/g)) add(m[1]);
['Autoplay an', 'Autoplay aus', 'Töne aus'].forEach(add);
for (const k of [...keys]) if (/^(https?:|#)/.test(k)) keys.delete(k);
['de', 'intl', 'Take On Me?'].forEach(k => keys.delete(k));
['OLED', 'Normal', 'Design'].forEach(k => keys.add(k)); // gleich, aber je Sprache prüfbar

if (process.argv.includes('--keys')) { console.log(JSON.stringify([...keys].sort(), null, 1)); process.exit(0); }

/* ---------- Sprachdateien prüfen ---------- */
const sandbox = { self: {} };
vm.createContext(sandbox);
const langDir = path.join(root, 'js', 'lang');
for (const f of fs.readdirSync(langDir).filter(f => f.endsWith('.js'))) vm.runInContext(fs.readFileSync(path.join(langDir, f), 'utf8'), sandbox, { filename: f });
const packs = sandbox.self.LANG_PACKS || {};
const vars = s => (s.match(/\{\w+\}/g) || []).sort().join(',');
let problems = 0;
for (const [lc, p] of Object.entries(packs)) {
  const have = Object.keys(p.dict);
  const missing = [...keys].filter(k => !Object.hasOwn(p.dict, k));
  const extra = have.filter(k => !keys.has(k));
  const badVars = have.filter(k => keys.has(k) && vars(p.dict[k]) !== vars(k));
  console.log(`\n${lc} (${p.flag} ${p.name}): ${have.length - extra.length} von ${keys.size} übersetzt`);
  if (missing.length) { console.log(`  fehlt (${missing.length}):`); missing.forEach(k => console.log('    - ' + JSON.stringify(k))); }
  if (extra.length) { console.log(`  nicht mehr benutzt (${extra.length}):`); extra.forEach(k => console.log('    - ' + JSON.stringify(k))); }
  if (badVars.length) { console.log('  Platzhalter passen nicht ({n} usw.):'); badVars.forEach(k => console.log('    - ' + JSON.stringify(k))); }
  problems += missing.length + badVars.length;
}
console.log(problems ? `\n${problems} Punkt(e) offen.` : `\nAlles vollständig (${Object.keys(packs).length + 1} Sprachen, ${keys.size} Texte).`);
process.exit(problems ? 1 : 0);
