// Logo- und Farbvarianten für Older or Newer → logo-options/index.html (zum Auswählen)
// Aufruf: node scripts/logo-options.js            (Übersicht)
//         node scripts/logo-options.js <id> > logo.svg   (eine Variante als Logo ausgeben)
const fs = require('fs'), path = require('path');

// old = Farbe für „Älter“, neu = Farbe für „Neuer“, bg = Hintergrund-Verlauf des Logos
const V = {
  neon:   { name: 'Neon', sub: 'Cyan & Violett – kühl, modern', bg: ['#0f172a', '#312e81'], old: ['#c4b5fd', '#8b5cf6'], neu: ['#a5f3fc', '#06b6d4'], kind: 'split' },
  retro:  { name: 'Retro → Pop', sub: 'Bernstein (alt) & Pink (neu) – Zeitreise in Farbe', bg: ['#2a1206', '#4a0d2e'], old: ['#fcd34d', '#f59e0b'], neu: ['#f9a8d4', '#ec4899'], kind: 'halves' },
  karten: { name: 'Karten', sub: 'Mint & Koralle – zwei Song-Karten wie im Spiel', bg: ['#052e2b', '#3b0a1a'], old: ['#fda4af', '#f43f5e'], neu: ['#6ee7b7', '#10b981'], kind: 'cards' },
  zeit:   { name: 'Zeitreise', sub: 'Gold & Türkis – Platte als Uhr mit Pfeilen', bg: ['#0c1f24', '#1c1405'], old: ['#fde68a', '#eab308'], neu: ['#99f6e4', '#14b8a6'], kind: 'clock' },
};

const grooves = (cx, cy, rs) => `<g fill="none" stroke="#fff" stroke-opacity=".08" stroke-width="2">${rs.map(r => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`).join('')}</g>`;
const defs = (v, p) => `<defs>
  <linearGradient id="${p}bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${v.bg[0]}"/><stop offset="1" stop-color="${v.bg[1]}"/></linearGradient>
  <linearGradient id="${p}o" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${v.old[0]}"/><stop offset="1" stop-color="${v.old[1]}"/></linearGradient>
  <linearGradient id="${p}n" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${v.neu[0]}"/><stop offset="1" stop-color="${v.neu[1]}"/></linearGradient>
  <filter id="${p}sh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#000" flood-opacity=".45"/></filter>
</defs>`;

function logo(id, p = '') {
  const v = V[id];
  let body = '';
  if (v.kind === 'split') {
    // Platte, Etikett oben/unten geteilt, dicke Pfeile
    body = `<g filter="url(#${p}sh)"><circle cx="256" cy="256" r="196" fill="#0d0d11"/></g>${grooves(256, 256, [182, 166, 150, 134])}
      <path d="M256 256 L118 117 A196 196 0 0 1 176 77 Z" fill="#fff" fill-opacity=".08"/>
      <clipPath id="${p}c"><circle cx="256" cy="256" r="110"/></clipPath>
      <g clip-path="url(#${p}c)"><rect x="140" y="140" width="232" height="114" fill="url(#${p}n)"/><rect x="140" y="258" width="232" height="114" fill="url(#${p}o)"/></g>
      <g fill="none" stroke="#0b1020" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"><path d="M212 226l44-44 44 44"/><path d="M212 286l44 44 44-44"/></g>`;
  } else if (v.kind === 'halves') {
    // Platte: linke Hälfte alt (Bernstein), rechte Hälfte neu (Pink), Pfeile links runter / rechts hoch
    body = `<g filter="url(#${p}sh)"><circle cx="256" cy="256" r="200" fill="#0d0d11"/></g>${grooves(256, 256, [186, 170, 154, 138, 122])}
      <path d="M256 156 A100 100 0 0 0 256 356 Z" fill="url(#${p}o)"/><path d="M256 156 A100 100 0 0 1 256 356 Z" fill="url(#${p}n)"/>
      <circle cx="256" cy="256" r="12" fill="#0d0d11"/>
      <g fill="none" stroke="#1a0b12" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"><path d="M212 220v60M190 262l22 22 22-22"/><path d="M300 292v-60M278 250l22-22 22 22"/></g>`;
  } else if (v.kind === 'cards') {
    // Zwei Song-Karten übereinander (wie im Spiel), oben mit Jahr, unten mit „?“
    const card = (y, rot, fill, txt) => `<g transform="rotate(${rot} 256 ${y + 70})"><rect x="96" y="${y}" width="320" height="140" rx="30" fill="${fill}" filter="url(#${p}sh)"/>
      <circle cx="166" cy="${y + 70}" r="44" fill="#0d0d11"/><circle cx="166" cy="${y + 70}" r="14" fill="#fff" fill-opacity=".85"/>
      <text x="330" y="${y + 92}" font-family="Outfit,Arial Black,sans-serif" font-weight="900" font-size="66" text-anchor="middle" fill="#0b1416">${txt}</text></g>`;
    body = card(96, -6, `url(#${p}o)`, '’85') + card(272, 5, `url(#${p}n)`, '?');
  } else {
    // Platte als Uhr: Zeiger + Pfeil-Ring (zurück = alt, vor = neu)
    body = `<g filter="url(#${p}sh)"><circle cx="256" cy="256" r="164" fill="#0d0d11"/></g>${grooves(256, 256, [150, 134, 118])}
      <circle cx="256" cy="256" r="70" fill="url(#${p}n)"/><circle cx="256" cy="256" r="10" fill="#0d0d11"/>
      <g stroke="#0d0d11" stroke-width="14" stroke-linecap="round"><path d="M256 256V206M256 256l34 22"/></g>
      <g fill="none" stroke-width="26" stroke-linecap="round"><path d="M90 256A166 166 0 0 1 256 90" stroke="url(#${p}n)"/><path d="M422 256A166 166 0 0 1 256 422" stroke="url(#${p}o)"/></g>
      <path d="M232 64l40 26-40 26z" fill="${v.neu[1]}"/><path d="M280 448l-40-26 40-26z" fill="${v.old[1]}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
<!-- Older or Newer – Variante „${v.name}“ -->
${defs(v, p)}<rect width="512" height="512" fill="url(#${p}bg)"/>
${body}
</svg>
`;
}

const pick = process.argv[2];
if (pick) { process.stdout.write(logo(pick)); return; }

// Vorschau: Logo groß, App-Icon klein, dazu eine Song-Karte und die zwei Knöpfe in den Farben der Variante
const mock = v => `<div class="mock" style="--o1:${v.old[0]};--o2:${v.old[1]};--n1:${v.neu[0]};--n2:${v.neu[1]};--b1:${v.bg[0]};--b2:${v.bg[1]}">
  <div class="song k"><i></i><span><b>Take On Me</b><small>a-ha</small></span><em>1985</em></div>
  <div class="song q"><i></i><span><b>Wonderwall</b><small>Oasis</small></span><em>?</em></div>
  <div class="btns"><div class="ans o"><span>↓</span><b>Älter<small>vor 1985</small></b></div><div class="ans n"><span>↑</span><b>Neuer<small>nach 1985</small></b></div></div>
</div>`;
let cards = '';
for (const [id, v] of Object.entries(V)) {
  cards += `<div class="c"><div class="top"><div class="i">${logo(id, id + 'a')}</div><div><b>${v.name}</b><p>${v.sub}</p><div class="s">${logo(id, id + 'b')}</div></div></div>${mock(v)}</div>`;
}
const out = path.join(__dirname, '..', 'logo-options');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'index.html'), `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Logo-Auswahl</title>
<style>@font-face{font-family:Outfit;font-weight:400 900;src:url(../fonts/outfit-latin.woff2) format('woff2')}
body{margin:0;background:#0c0c0f;color:#f4f4f6;font-family:Outfit,system-ui,sans-serif;padding:24px}
h1{margin:0 0 18px;font-size:26px}.g{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:20px}
.c{background:#17171c;border:1px solid #2a2a33;border-radius:26px;padding:20px}
.top{display:flex;gap:16px;align-items:center;margin-bottom:16px}.i{width:150px;height:150px;border-radius:34px;overflow:hidden;flex:none;box-shadow:0 18px 40px -16px #000}
.top b{font-size:24px;font-weight:900}.top p{margin:4px 0 10px;color:#a1a1ad;font-size:14px}.s{width:40px;height:40px;border-radius:10px;overflow:hidden}
.mock{border-radius:20px;padding:12px;background:linear-gradient(160deg,var(--b1),var(--b2));display:grid;gap:8px}
.song{display:flex;align-items:center;gap:10px;padding:8px;border-radius:14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1)}
.song i{width:40px;height:40px;border-radius:9px;background:#222}.song span{flex:1;display:flex;flex-direction:column}.song small{color:#a1a1ad}
.song em{font-style:normal;font-weight:900;font-size:26px}.song.k em{color:var(--n2)}.song.q{border-color:color-mix(in srgb,var(--n2) 50%,transparent)}.song.q em{color:var(--n1)}
.btns{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ans{display:flex;align-items:center;gap:8px;padding:10px;border-radius:14px}
.ans span{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;font-weight:900;color:#111}.ans b{display:flex;flex-direction:column;font-size:18px}.ans small{font-size:11px;font-weight:600;opacity:.8}
.ans.o{background:color-mix(in srgb,var(--o2) 25%,#111);border:1px solid var(--o2)}.ans.o span{background:linear-gradient(var(--o1),var(--o2))}
.ans.n{background:color-mix(in srgb,var(--n2) 25%,#111);border:1px solid var(--n2)}.ans.n span{background:linear-gradient(var(--n1),var(--n2))}</style>
<h1>Older or Newer – Logo &amp; Farben</h1><div class="g">${cards}</div>`);
console.log('ok');
