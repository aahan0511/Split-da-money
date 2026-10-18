/* Builds the pixel-stair clip-paths. Border width = step size, so corners are a clean 1-pixel diagonal. */
(function(){
  function corner(n, s){
    var c = n*s, L = [];
    for (var k = 0; k < n; k++) L.push([-c+k*s, k*s], [-c+k*s, (k+1)*s]);
    L.push([0, c]);
    return L;
  }
  var left  = function(v){ return v === 0 ? '0' : v + 'px'; };
  var right = function(v){ return v === 0 ? '100%' : 'calc(100% - ' + v + 'px)'; };
  function poly(n, s){
    var T = corner(n, s), P = [];
    T.map(function(p){return [left(-p[0]), left(p[1])];}).reverse().forEach(function(p){P.push(p);});          // top-left
    T.forEach(function(p){P.push([right(-p[0]), left(p[1])]);});                                              // top-right
    T.map(function(p){return [right(-p[0]), right(p[1])];}).reverse().forEach(function(p){P.push(p);});       // bottom-right
    T.forEach(function(p){P.push([left(-p[0]), right(p[1])]);});                                              // bottom-left
    return 'polygon(' + P.map(function(p){return p[0] + ' ' + p[1];}).join(',') + ')';
  }
  // L = big pieces (4px border, 12px corners), M = small pieces (2px border, 8px corners)
  var css = ':root{--cpL:' + poly(3,4) + ';--cpLi:' + poly(2,4) + ';--cpM:' + poly(4,2) + ';--cpMi:' + poly(3,2) + '}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
})();

const $ = id => document.getElementById(id);
const nfEl = $('nf'), colsEl = $('cols');
const newExp = () => ({amt:'', why:''});
let people = [];        // [{name, exps:[{amt, why}]}]
let last = null;        // latest result, used for the picture

const esc = s => String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
const nameOf = i => (people[i].name && people[i].name.trim()) || `Friend ${i+1}`;
const fmt = p => '₹' + (p/100).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
const toPaise = a => Math.round((parseFloat(a) || 0) * 100);
const count = () => Math.max(2, Math.min(30, parseInt(nfEl.value, 10) || 2));

function build(focus){
  const n = count();
  while (people.length < n) people.push({name:'', exps:[newExp()]});   // data of hidden friends is kept
  colsEl.innerHTML = '';
  for (let i = 0; i < n; i++){
    const p = people[i];
    const d = document.createElement('div');
    d.className = `px M friend c${i%4}`;
    d.dataset.p = i;
    d.innerHTML =
      `<div><label>Name</label><div class="px M field"><input class="nm" placeholder="Friend ${i+1}" value="${esc(p.name)}"></div></div>
       <div><label>Paid (₹) &amp; reason</label>
         <div class="exps">${p.exps.map((e,j) =>
           `<div class="exp" data-e="${j}">
              <div class="px M field"><input class="am" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0" value="${esc(e.amt)}"></div>
              <div class="px M field"><input class="wy" placeholder="Reason (optional)" value="${esc(e.why)}"></div>
              <button class="px M btn rm" type="button" title="Remove this expense" aria-label="Remove expense">&times;</button>
            </div>`).join('')}
         </div>
       </div>
       <button class="px M btn add" type="button">+ Add expense</button>
       <div class="sub" id="sub${i}"></div>
       <div class="px M chip" id="bal${i}"></div>`;
    colsEl.appendChild(d);
  }
  calc();
  if (focus){
    const el = colsEl.querySelector(`.friend[data-p="${focus.p}"] .exp:last-child .am`);
    if (el) el.focus();
  }
}

function calc(){
  const n = count();
  const list = people.slice(0, n);
  const paid = list.map(p => p.exps.reduce((s,e) => s + toPaise(e.amt), 0));  // paise: no rounding errors
  const total = paid.reduce((a,b) => a+b, 0);
  const base = Math.floor(total / n), rem = total - base * n;
  const share = Array.from({length:n}, (_,i) => base + (i < rem ? 1 : 0));
  const bal = paid.map((p,i) => p - share[i]);                                // + gets back, - has to pay

  bal.forEach((b,i) => {
    $('sub'+i).textContent = paid[i] ? `Total paid: ${fmt(paid[i])}` : '';
    const el = $('bal'+i);
    if (!total){ el.className = 'px M chip'; el.textContent = ''; }
    else if (b > 0){ el.className = 'px M chip gets'; el.textContent = `Gets back ${fmt(b)}`; }
    else if (b < 0){ el.className = 'px M chip pays'; el.textContent = `Needs to pay ${fmt(-b)}`; }
    else { el.className = 'px M chip'; el.textContent = 'All good'; }
  });

  const sum = $('summary');
  sum.hidden = !total;
  sum.textContent = `Total spent ${fmt(total)}. Each friend's fair share: ${fmt(total / n)}.`;

  const cr = [], db = [];
  bal.forEach((b,i) => { if (b>0) cr.push({i,v:b}); else if (b<0) db.push({i,v:-b}); });
  const out = [];
  while (cr.length && db.length){
    cr.sort((a,b)=>b.v-a.v); db.sort((a,b)=>b.v-a.v);
    const c = cr[0], d = db[0], x = Math.min(c.v, d.v);
    out.push({from:d.i,to:c.i,v:x});
    c.v -= x; d.v -= x;
    if (!c.v) cr.shift();
    if (!d.v) db.shift();
  }

  const ul = $('settle');
  if (!total) ul.innerHTML = '<li class="px M">Type the amounts above.</li>';
  else if (!out.length) ul.innerHTML = '<li class="px M">Everyone paid the same. Nothing to settle!</li>';
  else ul.innerHTML = out.map(t =>
    `<li class="px M t"><span class="who">${esc(nameOf(t.from))}</span> gives <span class="who to">${esc(nameOf(t.to))}</span><span class="amt">${fmt(t.v)}</span></li>`).join('');

  last = {n, paid, total, share: total / n, bal, out};
  $('export').disabled = !total;
  scheduleSync();
}

/* ---------- share link: the whole state lives in the URL hash ---------- */
const b64 = bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
                       return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); };
const unb64 = t => { t = t.replace(/-/g,'+').replace(/_/g,'/'); while (t.length % 4) t += '=';
                     const s = atob(t), a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; };
const pipe = async (bytes, stream) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());

function stateArray(){
  const n = count();
  return [n, people.slice(0, n).map(p => [
    p.name,
    p.exps.filter(e => e.amt !== '' || e.why !== '').map(e => [e.amt, e.why])
  ])];
}
const hasData = () => stateArray()[1].some(p => p[0].trim() || p[1].length);

async function encodeState(){
  const raw = new TextEncoder().encode(JSON.stringify(stateArray()));
  try { if (typeof CompressionStream === 'function') return 'z' + b64(await pipe(raw, new CompressionStream('deflate-raw'))); } catch(e){}
  return 'r' + b64(raw);
}
async function decodeState(code){
  let bytes = unb64(code.slice(1));
  if (code[0] === 'z') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
  else if (code[0] !== 'r') throw new Error('unknown format');
  const [n, list] = JSON.parse(new TextDecoder().decode(bytes));
  const cl = (v, m) => String(v == null ? '' : v).slice(0, m);
  const nn = Math.max(2, Math.min(30, parseInt(n, 10) || 2));
  const ppl = (Array.isArray(list) ? list : []).slice(0, nn).map(p => {
    const exps = (Array.isArray(p[1]) ? p[1] : []).slice(0, 50).map(e => ({amt: cl(e[0], 20), why: cl(e[1], 200)}));
    return {name: cl(p[0], 100), exps: exps.length ? exps : [newExp()]};
  });
  while (ppl.length < nn) ppl.push({name:'', exps:[newExp()]});
  return {n: nn, people: ppl};
}
async function shareUrl(){
  return location.href.split('#')[0] + '#d=' + await encodeState();
}

let syncTimer = null;
function scheduleSync(){
  clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {   // keep the address bar equal to the share link
    try {
      const url = hasData() ? await shareUrl() : location.href.split('#')[0];
      history.replaceState(null, '', url);
    } catch(e){}
  }, 300);
}

let toastTimer = null;
function toast(msg, ms){
  const t = $('toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms || 3000);
}
async function copyText(text){
  try { await navigator.clipboard.writeText(text); return true; } catch(e){}
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
  document.body.appendChild(ta); ta.select();
  let ok = false; try { ok = document.execCommand('copy'); } catch(e){}
  ta.remove(); return ok;
}
async function copyLink(){
  const url = await shareUrl();
  try { history.replaceState(null, '', url); } catch(e){}
  if (await copyText(url)){
    toast(location.protocol === 'file:'
      ? 'Link copied! It only opens on this computer. Put split-da-money.html online (any web host) so friends can open it.'
      : 'Link copied! Anyone who opens it sees these details and can edit them.', location.protocol === 'file:' ? 7000 : 3500);
  } else {
    window.prompt('Copy this link:', url);
  }
}

async function loadFromHash(){
  const m = location.hash.match(/^#d=([rz][A-Za-z0-9_-]*)$/);
  if (!m) return false;
  try {
    const s = await decodeState(m[1]);
    people = s.people; nfEl.value = s.n;
    return true;
  } catch(e){
    toast('This link looks broken, so it could not be opened.', 5000);
    return false;
  }
}

/* ---------- events ---------- */
colsEl.addEventListener('input', e => {
  const f = e.target.closest('.friend'); if (!f) return;
  const p = people[+f.dataset.p];
  if (e.target.classList.contains('nm')) p.name = e.target.value;
  else {
    const row = e.target.closest('.exp'); if (!row) return;
    const ex = p.exps[+row.dataset.e];
    if (e.target.classList.contains('am')) ex.amt = e.target.value;
    if (e.target.classList.contains('wy')) ex.why = e.target.value;
  }
  calc();
});
colsEl.addEventListener('click', e => {
  const f = e.target.closest('.friend'); if (!f) return;
  const pi = +f.dataset.p, p = people[pi];
  if (e.target.closest('.add')){
    p.exps.push(newExp());
    build({p:pi});
  } else if (e.target.closest('.rm')){
    const j = +e.target.closest('.exp').dataset.e;
    if (p.exps.length > 1) p.exps.splice(j, 1); else p.exps[0] = newExp();
    build();
  }
});
nfEl.addEventListener('input', () => build());
$('reset').addEventListener('click', () => { people.forEach(p => p.exps = [newExp()]); build(); });
$('export').addEventListener('click', exportPicture);
$('link').addEventListener('click', copyLink);
window.addEventListener('hashchange', async () => { if (await loadFromHash()) build(); });

/* ---------- export as picture (drawn on a canvas, works offline) ---------- */
const INK = '#2b2118';
function corner(n, s){
  const c = n*s, L = [];
  for (let k = 0; k < n; k++) L.push([-c+k*s, k*s], [-c+k*s, (k+1)*s]);
  L.push([0, c]);
  return L;
}
function poly(x, y, w, h, s, n){
  const T = corner(n, s);
  const TL = T.map(([a,b]) => [x - a, y + b]).reverse();
  const TR = T.map(([a,b]) => [x + w + a, y + b]);
  const BR = T.map(([a,b]) => [x + w + a, y + h - b]).reverse();
  const BL = T.map(([a,b]) => [x - a, y + h - b]);
  return [...TL, ...TR, ...BR, ...BL];
}
function fillPoly(ctx, pts, color){
  ctx.fillStyle = color; ctx.beginPath();
  pts.forEach(([a,b],i) => i ? ctx.lineTo(a,b) : ctx.moveTo(a,b));
  ctx.closePath(); ctx.fill();
}
// same shapes as the page: 'L' = 4px border / 12px corners, 'M' = 2px border / 8px corners
function box(ctx, x, y, w, h, fill, kind){
  const b = kind === 'M' ? 2 : 4, n = kind === 'M' ? 4 : 3;
  fillPoly(ctx, poly(x, y, w, h, b, n), INK);
  fillPoly(ctx, poly(x+b, y+b, w-2*b, h-2*b, b, n-1), fill);
  ctx.fillStyle = 'rgba(0,0,0,.10)';
  ctx.fillRect(x + b*(n), y + h - 2*b, w - 2*b*n, b);
}
function fit(ctx, text, maxW){
  if (ctx.measureText(text).width <= maxW) return text;
  while (text.length > 1 && ctx.measureText(text + '…').width > maxW) text = text.slice(0, -1);
  return text + '…';
}
function txt(ctx, text, x, y, size, align, maxW, color){
  ctx.font = `700 ${size}px "Space Mono","Courier New",monospace`;
  ctx.fillStyle = color || INK; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(maxW ? fit(ctx, text, maxW) : text, x, y);
}

async function exportPicture(){
  if (!last || !last.total) return;
  try { await document.fonts.load('700 16px "Space Mono"'); } catch(e){}
  const {n, paid, total, share, bal, out} = last;
  const COLORS = ['#f8dc8f','#c3e8ec','#f6c9b6','#e6efc9'];

  // what each person paid (only lines with an amount)
  const blocks = people.slice(0, n).map((p, i) => ({
    i, name: nameOf(i), paid: paid[i], bal: bal[i],
    rows: p.exps.filter(e => toPaise(e.amt) > 0).map(e => ({why: (e.why || '').trim() || '—', amt: toPaise(e.amt)}))
  }));

  const W = 900, pad = 28, S = 2, inner = W - 2*pad, gap = 28;
  const pillH = 38, panelTop = 22, panelBottom = 24;
  const rowH = 52, cardGap = 16;
  const blockH = b => 12 + 38 + (b.rows.length ? b.rows.length*32 + 6 : 0) + 14;
  const expH = panelTop + pillH + 18 + blocks.reduce((s,b) => s + blockH(b), 0) + cardGap*(blocks.length-1) + panelBottom;
  const payRows = Math.max(1, out.length);
  const payH = panelTop + pillH + 18 + payRows*rowH - 8 + panelBottom;
  const H = 88 + gap + 88 + gap + expH + gap + payH + gap + 52;

  const c = document.createElement('canvas');
  c.width = W*S; c.height = H*S;
  const ctx = c.getContext('2d');
  ctx.scale(S, S);

  // page background
  ctx.fillStyle = '#f5e6bc'; ctx.fillRect(0, 0, W, H);

  // header
  ctx.fillStyle = '#f2bf5e'; ctx.fillRect(0, 0, W, 88);
  ctx.fillStyle = INK; ctx.fillRect(0, 84, W, 4);
  txt(ctx, '★ SPLIT-DA-MONEY', pad, 44, 30);
  txt(ctx, new Date().toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}), W-pad, 44, 15, 'right');

  let y = 88 + gap;
  const pill = (label, py, color) => {
    ctx.font = '700 15px "Space Mono","Courier New",monospace';
    const w = ctx.measureText(label).width + 36;
    box(ctx, pad+26, py, w, pillH, color, 'L');
    txt(ctx, label, pad+26+18, py+pillH/2+1, 15);
  };

  // summary
  box(ctx, pad, y, inner, 88, '#f5c542', 'L');
  txt(ctx, 'TOTAL SPENT', pad+30, y+32, 13);
  txt(ctx, fmt(total), pad+30, y+60, 26);
  txt(ctx, 'EACH FRIEND SHOULD PAY', W/2+10, y+32, 13);
  txt(ctx, fmt(Math.round(share)), W/2+10, y+60, 26);
  y += 88 + gap;

  // expenses: what was paid by whom and why
  box(ctx, pad, y, inner, expH, '#c9e0a6', 'L');
  pill('WHO PAID WHAT', y + panelTop, '#3cc4cf');
  let by = y + panelTop + pillH + 18;
  const bx = pad + 26, bw = inner - 52;
  blocks.forEach(b => {
    const h = blockH(b);
    box(ctx, bx, by, bw, h, COLORS[b.i % 4], 'M');
    const hy = by + 12 + 19;
    txt(ctx, b.name, bx+20, hy, 17, 'left', bw*0.32);
    txt(ctx, 'PAID ' + fmt(b.paid), bx+bw*0.40, hy, 14);
    const lab = b.bal > 0 ? 'GETS ' + fmt(b.bal) : b.bal < 0 ? 'PAYS ' + fmt(-b.bal) : 'ALL GOOD';
    const col = b.bal > 0 ? '#8fdc7a' : b.bal < 0 ? '#e2503a' : '#fff7e0';
    const cw = 200, cx = bx + bw - cw - 14;
    box(ctx, cx, by+12+3, cw, 32, col, 'M');
    txt(ctx, lab, cx+cw/2, hy+1, 13, 'center', cw-16, b.bal < 0 ? '#ffffff' : INK);
    let ry = by + 12 + 38 + 2;
    b.rows.forEach(r => {
      const cy = ry + 15;
      ctx.fillStyle = INK; ctx.fillRect(bx+22, cy-3, 6, 6);
      txt(ctx, r.why, bx+38, cy, 15, 'left', bw-38-170);
      txt(ctx, fmt(r.amt), bx+bw-20, cy, 15, 'right');
      ry += 32;
    });
    by += h + cardGap;
  });
  y += expH + gap;

  // settlement
  box(ctx, pad, y, inner, payH, '#f6c878', 'L');
  pill('SETTLEMENT', y + panelTop, '#3cc4cf');
  let ry = y + panelTop + pillH + 18;
  if (!out.length){
    box(ctx, bx, ry, bw, rowH-8, '#fff7e0', 'M');
    txt(ctx, 'Everyone paid the same. Nothing to settle!', bx+18, ry+(rowH-8)/2+1, 15);
  } else out.forEach(t => {
    box(ctx, bx, ry, bw, rowH-8, '#fff7e0', 'M');
    txt(ctx, `${nameOf(t.from)}  gives  ${nameOf(t.to)}`, bx+18, ry+(rowH-8)/2+1, 16, 'left', bw-210);
    const aw = 170, ax = bx + bw - aw - 8;
    box(ctx, ax, ry+5, aw, rowH-18, '#f5c542', 'M');
    txt(ctx, fmt(t.v), ax+aw/2, ry+(rowH-8)/2+1, 15, 'center', aw-12);
    ry += rowH;
  });
  y += payH + gap;

  // footer
  ctx.fillStyle = '#e8808f'; ctx.fillRect(0, H-52, W, 52);
  ctx.fillStyle = INK; ctx.fillRect(0, H-52, W, 4);
  txt(ctx, 'SPLIT-DA-MONEY', W/2, H-24, 13, 'center');

  c.toBlob(blob => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'split-da-money.png';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, 'image/png');
}

(async () => { await loadFromHash(); build(); })();   // open a shared link first, then draw
