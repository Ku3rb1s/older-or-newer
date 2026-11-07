// Logo- und Farbkonzepte für Older or Newer → logo-options/index.html (zum Auswählen, mit Vorschau des Spielbildschirms)
// Aufruf: node scripts/logo-options.js              (Übersicht)
//         node scripts/logo-options.js <id> > logo.svg   (ein Konzept als Logo ausgeben)
const fs = require('fs'), path = require('path');

// alt = Farbe für „Älter“, neu = Farbe für „Neuer“ (je [hell, kräftig]); bg = Hintergrund; blob = Farbflächen der App
const V = {
  spulen: {
    name: 'Spulen', sub: 'Platte mit ⏪ / ⏩ – zurück- und vorspulen wie am Plattenspieler. Gold & Türkis, ruhig und edel.',
    bg: ['#0e2a2f', '#0a1416'], alt: ['#fde68a', '#f59e0b'], neu: ['#a7f3d0', '#14b8a6'], blob: ['#0f3d3e', '#3d2a07'],
  },
  synth: {
    name: 'Synthwave', sub: 'Platte als Sonne über dem Horizont – 80er-Retro. Orange & Magenta, laut und party-tauglich.',
    bg: ['#2a0b3d', '#12051f'], alt: ['#fdba74', '#f97316'], neu: ['#f5d0fe', '#d946ef'], blob: ['#4a1260', '#5a1d0a'],
  },
  stapel: {
    name: 'Plattenstapel', sub: 'Alte Platte hinten, neue vorne, Pfeil nach oben. Koralle & Himmelblau, frisch und freundlich.',
    bg: ['#0b1b3a', '#0a1022'], alt: ['#fecdd3', '#fb7185'], neu: ['#bae6fd', '#38bdf8'], blob: ['#123a6b', '#5b1a2c'],
  },
  zeitstrahl: {
    name: 'Zeitstrahl', sub: 'Platte als Regler auf einer Zeitleiste von früher bis heute. Bernstein & Violett, klar und modern.',
    bg: ['#1c1230', '#0d0a17'], alt: ['#fcd34d', '#f59e0b'], neu: ['#ddd6fe', '#8b5cf6'], blob: ['#3b1f73', '#4a2f05'],
  },
};

const grooves = (cx, cy, rs, o = .07) => `<g fill="none" stroke="#fff" stroke-opacity="${o}" stroke-width="2.5">${rs.map(r => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`).join('')}</g>`;
const sheen = (cx, cy, r) => `<path d="M${cx} ${cy}L${cx - r * .7} ${cy - r * .71}A${r} ${r} 0 0 1 ${cx - r * .38} ${cy - r * .92}Z" fill="#fff" fill-opacity=".08"/><path d="M${cx} ${cy}L${cx + r * .7} ${cy + r * .71}A${r} ${r} 0 0 1 ${cx + r * .38} ${cy + r * .92}Z" fill="#fff" fill-opacity=".08"/>`;
const grad = (id, [a, b], x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
const shadow = p => `<filter id="${p}sh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="16" stdDeviation="18" flood-color="#000" flood-opacity=".5"/></filter>`;

function logo(id, p = '') {
  const v = V[id];
  let d = grad(p + 'bg', v.bg, 1, 1) + grad(p + 'a', v.alt) + grad(p + 'n', v.neu) + shadow(p), b = '';
  if (id === 'spulen') {
    // Platte, Etikett links gold (⏪), rechts türkis (⏩)
    d += `<clipPath id="${p}lab"><circle cx="256" cy="256" r="104"/></clipPath><radialGradient id="${p}gl" cx=".5" cy=".5" r=".5"><stop offset=".5" stop-color="${v.neu[1]}" stop-opacity=".25"/><stop offset="1" stop-color="${v.neu[1]}" stop-opacity="0"/></radialGradient>`;
    b = `<circle cx="256" cy="256" r="250" fill="url(#${p}gl)"/>
      <g filter="url(#${p}sh)"><circle cx="256" cy="256" r="200" fill="#0c0c10"/></g>${grooves(256, 256, [186, 170, 154, 138, 122])}${sheen(256, 256, 200)}
      <g clip-path="url(#${p}lab)"><rect x="150" y="150" width="106" height="212" fill="url(#${p}a)"/><rect x="256" y="150" width="106" height="212" fill="url(#${p}n)"/></g>
      <rect x="253" y="150" width="6" height="212" fill="#0c0c10"/>
      <g fill="#0b1214"><path d="M244 226v60l-34-30zM208 226v60l-34-30z"/><path d="M268 226v60l34-30zM304 226v60l34-30z"/></g>`;
  } else if (id === 'synth') {
    // Sonne (Platte mit Streifen) über einem Raster-Horizont
    d += `<clipPath id="${p}sun"><rect x="0" y="0" width="512" height="318"/></clipPath>${grad(p + 's', [v.alt[0], v.neu[1]])}`;
    const stripes = [252, 274, 294, 312].map((y, k) => `<rect x="60" y="${y}" width="392" height="${4 + k * 2}" fill="url(#${p}bg)"/>`).join('');
    const grid = [338, 362, 394, 440, 512].map(y => `<path d="M0 ${y}H512"/>`).join('') + [-300, -150, 0, 150, 300].map(x => `<path d="M${256 + x * .25} 318L${256 + x * 2} 512"/>`).join('');
    b = `<g clip-path="url(#${p}sun)" filter="url(#${p}sh)"><circle cx="256" cy="236" r="168" fill="url(#${p}s)"/>${stripes}</g>
      <g clip-path="url(#${p}sun)"><circle cx="256" cy="236" r="62" fill="#14061f"/>${grooves(256, 236, [128, 108, 88], .12)}<circle cx="256" cy="236" r="12" fill="url(#${p}s)"/></g>
      <path d="M0 318H512" stroke="${v.neu[1]}" stroke-width="5"/>
      <g stroke="${v.neu[1]}" stroke-opacity=".55" stroke-width="3" fill="none">${grid}</g>`;
  } else if (id === 'stapel') {
    // zwei Platten: alte hinten (koralle), neue vorne (blau), Pfeil-Plakette
    const rec = (cx, cy, r, lab) => `<g filter="url(#${p}sh)"><circle cx="${cx}" cy="${cy}" r="${r}" fill="#0c0c10"/></g>${grooves(cx, cy, [r - 16, r - 32, r - 48, r - 64])}${sheen(cx, cy, r)}<circle cx="${cx}" cy="${cy}" r="${r * .36}" fill="url(#${p}${lab})"/><circle cx="${cx}" cy="${cy}" r="9" fill="#0c0c10"/>`;
    b = rec(196, 206, 150, 'a') + rec(306, 312, 160, 'n')
      + `<g filter="url(#${p}sh)"><circle cx="412" cy="112" r="66" fill="url(#${p}n)"/></g><path d="M412 146V82M386 106l26-26 26 26" fill="none" stroke="#0b1530" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>`;
  } else {
    // Zeitleiste mit Platte als Regler
    const ticks = [96, 146, 196, 316, 366, 416].map(x => `<path d="M${x} 352v22"/>`).join('');
    b = `<rect x="56" y="300" width="400" height="34" rx="17" fill="url(#${p}tl)"/>
      <g stroke="#fff" stroke-opacity=".35" stroke-width="5" stroke-linecap="round">${ticks}</g>
      <g filter="url(#${p}sh)"><circle cx="256" cy="230" r="150" fill="#0c0c10"/></g>${grooves(256, 230, [136, 120, 104, 88])}${sheen(256, 230, 150)}
      <circle cx="256" cy="230" r="54" fill="url(#${p}tl)"/><circle cx="256" cy="230" r="9" fill="#0c0c10"/>
      <g fill="none" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"><path d="M110 430H40M66 404l-26 26 26 26" stroke="${v.alt[1]}"/><path d="M402 430h70M446 404l26 26-26 26" stroke="${v.neu[1]}"/></g>`;
    d += `<linearGradient id="${p}tl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${v.alt[1]}"/><stop offset="1" stop-color="${v.neu[1]}"/></linearGradient>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
<!-- Older or Newer – Konzept „${v.name}“ -->
<defs>${d}</defs>
<rect width="512" height="512" fill="url(#${p}bg)"/>
${b}
</svg>
`;
}

const pick = process.argv[2];
if (pick) { process.stdout.write(logo(pick)); return; }

// Vorschau: Spielbildschirm im Konzept (Kopfzeile, zwei Song-Karten, Knöpfe, Lautstärke)
const mock = (id, v) => `<div class="mock" style="--a1:${v.alt[0]};--a2:${v.alt[1]};--n1:${v.neu[0]};--n2:${v.neu[1]};--b1:${v.blob[0]};--b2:${v.blob[1]}">
  <i class="blob b1"></i><i class="blob b2"></i>
  <div class="hd"><span class="lg">${logo(id, id + 'h')}</span><b>Older or Newer</b><span class="pill">🔥 Serie 4</span></div>
  <div class="stage">
    <div class="song k"><span class="cv" style="background:linear-gradient(135deg,#475569,#1e293b)"></span><span class="tx"><b>Take On Me</b><small>a-ha</small></span><em>1985</em></div>
    <div class="vs">Ist dieser Song älter oder neuer?</div>
    <div class="song q"><span class="cv" style="background:linear-gradient(135deg,#7c2d12,#1c1917)"></span><span class="tx"><b>Wonderwall</b><small>Oasis</small></span><em>?</em></div>
    <div class="btns"><div class="ans o"><span>↓</span><b>Älter<small>vor 1985</small></b></div><div class="ans n"><span>↑</span><b>Neuer<small>nach 1985</small></b></div></div>
    <div class="vol"><span>🔊</span><i><u></u></i></div>
  </div>
</div>`;
let cards = '';
for (const [id, v] of Object.entries(V)) {
  cards += `<div class="c"><div class="top"><div class="i">${logo(id, id + 'a')}</div><div class="meta"><b>${v.name}</b><p>${v.sub}</p>
    <div class="sw"><i style="background:${v.alt[1]}"></i>Älter <i style="background:${v.neu[1]}"></i>Neuer</div><div class="s">${logo(id, id + 'b')}</div></div></div>${mock(id, v)}</div>`;
}
const out = path.join(__dirname, '..', 'logo-options');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'index.html'), `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Logo-Auswahl</title>
<style>@font-face{font-family:Outfit;font-weight:400 900;src:url(../fonts/outfit-latin.woff2) format('woff2')}
*{box-sizing:border-box}body{margin:0;background:#0b0b0e;color:#f4f4f6;font-family:Outfit,system-ui,sans-serif;padding:24px}
h1{margin:0 0 4px;font-size:26px}h1+p{margin:0 0 20px;color:#a1a1ad}
.g{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:22px}
.c{background:#15151a;border:1px solid #26262e;border-radius:28px;padding:20px}
.top{display:flex;gap:18px;align-items:flex-start;margin-bottom:16px}.i{width:150px;height:150px;border-radius:34px;overflow:hidden;flex:none;box-shadow:0 18px 40px -16px #000}
.meta b{font-size:26px;font-weight:900}.meta p{margin:4px 0 10px;color:#a1a1ad;font-size:14px;line-height:1.35}
.sw{display:flex;align-items:center;gap:6px;font-size:13px;color:#d4d4d8;margin-bottom:10px}.sw i{width:16px;height:16px;border-radius:50%;margin-left:6px}.sw i:first-child{margin-left:0}
.s{width:44px;height:44px;border-radius:11px;overflow:hidden}
.mock{position:relative;overflow:hidden;border-radius:22px;padding:12px;background:#0c0c0f;isolation:isolate}
.blob{position:absolute;border-radius:50%;filter:blur(40px);opacity:.75;z-index:-1}.b1{width:260px;height:260px;left:-80px;top:-90px;background:var(--b1)}.b2{width:240px;height:240px;right:-90px;bottom:-80px;background:var(--b2)}
.hd{display:flex;align-items:center;gap:8px;margin-bottom:10px}.lg{width:28px;height:28px;border-radius:8px;overflow:hidden}.hd b{font-weight:900;font-size:17px;flex:1}
.pill{font-size:12px;border:1px solid rgba(255,255,255,.18);border-radius:99px;padding:2px 9px;color:#e4e4e7}
.stage{background:rgba(30,30,38,.55);border:1px solid rgba(255,255,255,.1);border-radius:18px;padding:10px;display:grid;gap:8px;backdrop-filter:blur(8px)}
.song{display:flex;align-items:center;gap:10px;padding:8px;border-radius:14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1)}
.cv{width:44px;height:44px;border-radius:10px;flex:none}.tx{flex:1;display:flex;flex-direction:column}.tx small{color:#a1a1ad;font-size:12px}
.song em{font-style:normal;font-weight:900;font-size:28px}.song.k em{color:var(--n2)}.song.q{background:rgba(255,255,255,.09);border-color:rgba(255,255,255,.22)}.song.q em{color:#e4e4e7;opacity:.7}
.vs{text-align:center;font-size:12px;color:#a1a1ad}
.btns{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:2px}.ans{display:flex;align-items:center;gap:9px;padding:10px;border-radius:15px}
.ans span{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;font-weight:900;color:#111;font-size:18px}.ans b{display:flex;flex-direction:column;font-size:19px;font-weight:900;line-height:1}.ans small{font-size:11px;font-weight:600;opacity:.85;margin-top:2px}
.ans.o{background:linear-gradient(160deg,color-mix(in srgb,var(--a2) 32%,#18181b),color-mix(in srgb,var(--a2) 10%,#0c0c0f));border:1px solid color-mix(in srgb,var(--a2) 60%,transparent)}.ans.o span{background:linear-gradient(var(--a1),var(--a2))}.ans.o small{color:var(--a1)}
.ans.n{background:linear-gradient(160deg,color-mix(in srgb,var(--n2) 32%,#18181b),color-mix(in srgb,var(--n2) 10%,#0c0c0f));border:1px solid color-mix(in srgb,var(--n2) 60%,transparent)}.ans.n span{background:linear-gradient(var(--n1),var(--n2))}.ans.n small{color:var(--n1)}
.vol{display:flex;align-items:center;gap:8px;justify-content:center;font-size:12px}.vol i{width:150px;height:4px;border-radius:4px;background:rgba(255,255,255,.15)}.vol u{display:block;width:70%;height:100%;border-radius:4px;background:linear-gradient(90deg,var(--a2),var(--n2))}
</style>
<h1>Older or Newer – Logo &amp; Farben</h1><p>Vier Konzepte, jeweils mit Spielbildschirm in den passenden Farben.</p><div class="g">${cards}</div>`);
console.log('ok');
