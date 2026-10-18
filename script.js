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
const colsEl = $('cols'), boardEl = $('board');
const newExp = () => ({amt:'', why:'', skip:[]});
let people = [];        // [{name, exps:[{amt, why, skip:[friend indices left out], open}]}]
let last = null;        // latest result, used for the picture

const esc = s => String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
const nameOf = i => (people[i].name && people[i].name.trim()) || `Friend ${i+1}`;
const fmt = p => '₹' + (p/100).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
const toPaise = a => Math.round((parseFloat(a) || 0) * 100);
const MIN_FRIENDS = 2, MAX_FRIENDS = 30;
const newFriend = () => ({name:'', exps:[newExp()]});
const count = () => people.length;
// pixel-art icons: '#' = one 2px pixel, drawn as crisp SVG squares
const pixIcon = rows => {
  const d = rows.flatMap((r, y) => [...r].map((c, x) => c === '#' ? `M${x} ${y}h1v1h-1z` : '')).join('');
  return `<svg width="${rows[0].length*2}" height="${rows.length*2}" viewBox="0 0 ${rows[0].length} ${rows.length}" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="${d}"/></svg>`;
};
const ICON_OPEN = pixIcon(['...##','..##.','.##..','##...','##...','.##..','..##.','...##']);
const ICON_GRIP = pixIcon(['##.##','##.##','.....','##.##','##.##','.....','##.##','##.##']);
const ICON_SIZE = pixIcon(['.....#','......','...#.#','......','.#.#.#','......']);
const ICON_RM   = pixIcon(['##....##','.##..##.','..####..','...##...','...##...','..####..','.##..##.','##....##']);
const tagText = i => Array.from((people[i].name || '').trim())[0]?.toUpperCase() || String(i+1);
const skipped = (e, n) => e.skip.filter(q => q < n).sort((a,b) => a-b);
// who shares an expense: everyone not left out (if somehow nobody is left, everyone shares it)
const sharers = (e, n) => { const s = Array.from({length:n}, (_,q) => q).filter(q => !e.skip.includes(q)); return s.length ? s : Array.from({length:n}, (_,q) => q); };

function build(focus){
  const n = count();
  colsEl.innerHTML = '';
  for (let i = 0; i < n; i++){
    const p = people[i];
    const d = document.createElement('div');
    d.className = `px M friend c${i%4}`;
    d.dataset.p = i;
    d.innerHTML =
      `<div class="gi-in">
       <div><div class="card-top"><label>Name</label><span class="gtools">
         <button class="px M btn grip" type="button" title="Drag to move" aria-label="Move ${esc(nameOf(i))}">${ICON_GRIP}</button>
         ${n > MIN_FRIENDS ? `<button class="px M btn rmf" type="button" title="Remove this friend" aria-label="Remove ${esc(nameOf(i))}">${ICON_RM}</button>` : ''}
       </span></div><div class="px M field"><input class="nm" placeholder="Friend ${i+1}" value="${esc(p.name)}"></div></div>
       <div><label>Paid (₹) &amp; reason</label>
         <div class="exps">${p.exps.map((e,j) =>
           `<div class="exp" data-e="${j}">
              <div class="px M field"><input class="am" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0" value="${esc(e.amt)}"></div>
              <div class="px M field"><input class="wy" placeholder="Reason (optional)" value="${esc(e.why)}"></div>
              <button class="px M btn ex${e.open ? ' open' : ''}${skipped(e, n).length ? ' on' : ''}" type="button"
                title="${skipped(e, n).length ? 'Not split with: ' + esc(skipped(e, n).map(nameOf).join(', ')) : 'Choose who shares this expense'}"
                aria-label="Choose who shares this expense" aria-expanded="${!!e.open}">${ICON_OPEN}</button>
              <button class="px M btn rm" type="button" title="Remove this expense" aria-label="Remove expense">${ICON_RM}</button>
              ${e.open ? `<div class="tags"><span>Split with</span>${Array.from({length:n}, (_,q) => {
                const off = e.skip.includes(q);
                return `<button class="px M btn tag c${q%4}${off ? ' off' : ''}" type="button" data-q="${q}" aria-pressed="${!off}"
                  title="${esc(nameOf(q))}${off ? ' (left out)' : ''}">${esc(tagText(q))}</button>`;
              }).join('')}</div>` : ''}
            </div>`).join('')}
         </div>
       </div>
       <button class="px M btn add" type="button">+ Add expense</button>
       <div class="sub" id="sub${i}"></div>
       <div class="px M chip" id="bal${i}"></div>
       </div>
       <span class="sizer" title="Drag to resize">${ICON_SIZE}</span>`;
    colsEl.appendChild(d);
  }
  $('add-friend').disabled = n >= MAX_FRIENDS;
  calc();
  if (focus){
    const el = colsEl.querySelector(focus.name ? `.friend[data-p="${focus.p}"] .nm` : `.friend[data-p="${focus.p}"] .exp:last-child .am`);
    if (el) el.focus();
  }
}

function calc(){
  const n = count();
  const list = people.slice(0, n);
  const paid = list.map(p => p.exps.reduce((s,e) => s + toPaise(e.amt), 0));  // paise: no rounding errors
  const total = paid.reduce((a,b) => a+b, 0);
  // add up expenses shared by the same friends, then split each group in whole paise
  const groups = new Map();
  list.forEach(p => p.exps.forEach(e => {
    const a = toPaise(e.amt); if (!a) return;
    const k = sharers(e, n).join(',');
    groups.set(k, (groups.get(k) || 0) + a);
  }));
  const share = Array(n).fill(0);
  groups.forEach((a, k) => {
    const s = k.split(',').map(Number), base = Math.floor(a / s.length), rem = a - base * s.length;
    s.forEach((q, j) => share[q] += base + (j < rem ? 1 : 0));
  });
  const uneven = [...groups.keys()].some(k => k.split(',').length !== n);
  const bal = paid.map((p,i) => p - share[i]);                                // + gets back, - has to pay

  bal.forEach((b,i) => {
    $('sub'+i).textContent = [paid[i] ? `Total paid: ${fmt(paid[i])}` : '', uneven ? `Share: ${fmt(share[i])}` : ''].filter(Boolean).join(' · ');
    const el = $('bal'+i);
    if (!total){ el.className = 'px M chip'; el.textContent = ''; }
    else if (b > 0){ el.className = 'px M chip gets'; el.textContent = `Gets back ${fmt(b)}`; }
    else if (b < 0){ el.className = 'px M chip pays'; el.textContent = `Needs to pay ${fmt(-b)}`; }
    else { el.className = 'px M chip'; el.textContent = 'All good'; }
  });

  const sum = $('summary');
  sum.hidden = !total;
  sum.textContent = uneven
    ? `Total spent ${fmt(total)}. Some expenses leave friends out, so shares differ (see each friend).`
    : `Total spent ${fmt(total)}. Each friend's fair share: ${fmt(total / n)}.`;

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

  last = {n, paid, total, share, uneven, bal, out};
  $('export').disabled = $('export-pdf').disabled = !total;
  scheduleSync();
  relayout();
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
    p.exps.filter(e => e.amt !== '' || e.why !== '').map(e => e.skip.length ? [e.amt, e.why, [...e.skip].sort((a,b) => a-b)] : [e.amt, e.why])
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
  const nn = Math.max(MIN_FRIENDS, Math.min(MAX_FRIENDS, parseInt(n, 10) || MIN_FRIENDS));
  const ppl = (Array.isArray(list) ? list : []).slice(0, nn).map(p => {
    const exps = (Array.isArray(p[1]) ? p[1] : []).slice(0, 50).map(e => ({amt: cl(e[0], 20), why: cl(e[1], 200),
      skip: [...new Set((Array.isArray(e[2]) ? e[2] : []).map(Number).filter(q => Number.isInteger(q) && q >= 0 && q < nn))]}));
    return {name: cl(p[0], 100), exps: exps.length ? exps : [newExp()]};
  });
  while (ppl.length < nn) ppl.push(newFriend());
  return {n: nn, people: ppl};
}
const hereUrl = () => location.href.split('#')[0];
async function shareUrl(){
  return hereUrl() + '#d=' + await encodeState();
}

/* base URL of copied links: this page, the GitHub Pages copy, or any address the user types (saved in this browser) */
const BASE_KEY = 'sdm-base', GH_PAGES = 'https://aahan0511.github.io/Split-da-money/';
let base = {kind:'here', custom:''};
try { const b = JSON.parse(localStorage.getItem(BASE_KEY)); if (b && ['here','gh','custom'].includes(b.kind)) base = {kind: b.kind, custom: String(b.custom || '')}; } catch(e){}
const saveBase = () => { try { localStorage.setItem(BASE_KEY, JSON.stringify(base)); } catch(e){} };
// returns the chosen base without any #hash, or null when the custom one is not a usable address
function baseUrl(){
  if (base.kind === 'gh') return GH_PAGES;
  if (base.kind !== 'custom') return hereUrl();
  try {
    const u = new URL(base.custom.trim());
    if (!['http:','https:','file:'].includes(u.protocol)) return null;
    u.hash = ''; return u.href;
  } catch(e){ return null; }
}

let syncTimer = null;
function scheduleSync(){
  clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {   // keep the address bar equal to the share link
    try {
      const url = hasData() ? await shareUrl() : hereUrl();
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
  const code = await encodeState();
  try { history.replaceState(null, '', hereUrl() + '#d=' + code); } catch(e){}
  if (previewOn()) return showPreview('link', code);
  const b = baseUrl();
  if (!b) return toast('The custom base URL is not a valid address. Turn on "Preview first" to fix it.', 5000);
  await doCopyLink(b + '#d=' + code);
}
async function doCopyLink(url){
  if (await copyText(url)){
    const local = url.startsWith('file:');
    toast(local
      ? 'Link copied! It only opens on this computer. Put index.html online (any web host) so friends can open it.'
      : 'Link copied! Anyone who opens it sees these details and can edit them.', local ? 7000 : 3500);
  } else {
    window.prompt('Copy this link:', url);
  }
}

/* ---------- preview before copying / downloading ---------- */
const PREVIEW_KEY = 'sdm-preview';
const previewOn = () => $('preview').checked;
try { $('preview').checked = localStorage.getItem(PREVIEW_KEY) !== '0'; } catch(e){}
$('preview').addEventListener('change', () => {
  try { localStorage.setItem(PREVIEW_KEY, previewOn() ? '1' : '0'); } catch(e){}
});

let pv = null;          // what the open preview will copy / download: {kind, code, url} or {kind, url, blob, file, name}
function showPreview(kind, data){
  closePreview();
  const isLink = kind === 'link';
  pv = isLink ? {kind, code: data, url: ''} : {kind, ...data, url: URL.createObjectURL(data.blob)};
  $('pv-title').textContent = isLink ? 'Preview link' : kind === 'pdf' ? 'Preview PDF' : 'Preview picture';
  $('pv-go').textContent = isLink ? 'Copy link' : kind === 'pdf' ? 'Download PDF' : 'Download';
  $('pv-link').hidden = !isLink;
  $('pv-img').hidden = isLink;
  if (isLink){
    $('pv-base').value = base.kind;
    $('pv-custom').value = base.custom;
    updateLinkPreview();
  } else {
    $('pv-pic').src = pv.url;
  }
  $('pv').showModal();
}
function updateLinkPreview(){
  const b = baseUrl(), url = b ? b + '#d=' + pv.code : '';
  pv.url = url;
  $('pv-custom-wrap').hidden = base.kind !== 'custom';
  $('pv-url').value = url;
  $('pv-open').hidden = !url;
  if (url) $('pv-open').href = url;
  $('pv-go').disabled = !url;
  $('pv-info').textContent = url
    ? `${url.length} characters · ${count()} friends · total ${last && last.total ? fmt(last.total) : fmt(0)}`
    : 'Type a full address, like https://example.com/split/';
}
$('pv-base').addEventListener('change', e => {
  base.kind = e.target.value; saveBase();
  updateLinkPreview();
  if (base.kind === 'custom') $('pv-custom').focus();
});
$('pv-custom').addEventListener('input', e => {
  base.custom = e.target.value; saveBase();
  if (pv && pv.kind === 'link') updateLinkPreview();
});
function closePreview(){
  if (pv && pv.blob) URL.revokeObjectURL(pv.url);
  pv = null;
  $('pv-pic').removeAttribute('src');
  if ($('pv').open) $('pv').close();
}
$('pv-go').addEventListener('click', async () => {
  const cur = pv; if (!cur) return;
  if (cur.kind === 'link'){ if (!cur.url) return; await doCopyLink(cur.url); }
  else downloadBlob(cur.file, cur.name);
  closePreview();
});
$('pv-close').addEventListener('click', closePreview);
$('pv').addEventListener('close', () => { if (pv) closePreview(); });   // Esc key
$('pv').addEventListener('click', e => { if (e.target === $('pv')) closePreview(); });   // click on the backdrop
$('pv-url').addEventListener('focus', e => e.target.select());

async function loadFromHash(){
  const m = location.hash.match(/^#d=([rz][A-Za-z0-9_-]*)$/);
  if (!m) return false;
  try {
    const s = await decodeState(m[1]);
    people = s.people;
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
  if (e.target.classList.contains('nm')){
    p.name = e.target.value;
    const q = +f.dataset.p;
    colsEl.querySelectorAll(`.tag[data-q="${q}"]`).forEach(t => { t.textContent = tagText(q); t.title = nameOf(q) + (t.classList.contains('off') ? ' (left out)' : ''); });
  }
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
  } else if (e.target.closest('.ex')){
    const j = +e.target.closest('.exp').dataset.e;
    p.exps[j].open = !p.exps[j].open;
    build();
    colsEl.querySelector(`.friend[data-p="${pi}"] .exp[data-e="${j}"] .ex`).focus();
  } else if (e.target.closest('.tag')){
    const j = +e.target.closest('.exp').dataset.e, q = +e.target.closest('.tag').dataset.q, ex = p.exps[j];
    if (ex.skip.includes(q)) ex.skip = ex.skip.filter(x => x !== q);
    else if (skipped(ex, count()).length + 1 < count()) ex.skip.push(q);
    else return toast('At least one friend has to share this expense.');
    build();
    colsEl.querySelector(`.friend[data-p="${pi}"] .exp[data-e="${j}"] .tag[data-q="${q}"]`).focus();
  } else if (e.target.closest('.rmf')){
    if (people.length <= MIN_FRIENDS) return;
    people.splice(pi, 1);
    people.forEach(q => q.exps.forEach(ex => ex.skip = ex.skip.filter(x => x !== pi).map(x => x > pi ? x - 1 : x)));
    layout.cards.splice(pi, 1); saveLayout();
    build();
  } else if (e.target.closest('.rm')){
    const j = +e.target.closest('.exp').dataset.e;
    if (p.exps.length > 1) p.exps.splice(j, 1); else p.exps[0] = newExp();
    build();
  }
});
$('add-friend').addEventListener('click', () => {
  if (people.length >= MAX_FRIENDS) return;
  const i = people.length;
  people.push(newFriend());
  layout.cards[i] = defCard(i, true); saveLayout();
  build({p:i, name:true});
});
$('reset').addEventListener('click', () => { people.forEach(p => p.exps = [newExp()]); build(); });
$('export').addEventListener('click', () => exportPicture('png'));
$('export-pdf').addEventListener('click', () => exportPicture('pdf'));
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

async function exportPicture(kind){
  if (!last || !last.total) return;
  const c = await renderPicture();
  const blob = await canvasBlob(c, 'image/png');
  const file = kind === 'pdf' ? await canvasPdf(c) : blob;
  const name = 'split-da-money.' + kind;
  if (previewOn()) showPreview(kind, {blob, file, name});
  else downloadBlob(file, name);
}
function downloadBlob(blob, name){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

async function renderPicture(){
  try { await document.fonts.load('700 16px "Space Mono"'); } catch(e){}
  const {n, paid, total, share, uneven, bal, out} = last;
  const COLORS = ['#f8dc8f','#c3e8ec','#f6c9b6','#e6efc9'];

  // what each person paid (only lines with an amount)
  const blocks = people.slice(0, n).map((p, i) => ({
    i, name: nameOf(i), paid: paid[i], share: share[i], bal: bal[i],
    rows: p.exps.filter(e => toPaise(e.amt) > 0).map(e => {
      const out = skipped(e, n).length && sharers(e, n).length < n ? skipped(e, n) : [];
      return {why: ((e.why || '').trim() || '—') + (out.length ? ' {not for ' + out.map(nameOf).join(', ') + '}' : ''), amt: toPaise(e.amt)};
    })
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
  if (uneven){
    txt(ctx, 'FAIR SHARES', W/2+10, y+32, 13);
    txt(ctx, 'Differ, see below', W/2+10, y+60, 18);
  } else {
    txt(ctx, 'EACH FRIEND SHOULD PAY', W/2+10, y+32, 13);
    txt(ctx, fmt(Math.round(total / n)), W/2+10, y+60, 26);
  }
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
    if (uneven) txt(ctx, 'PAID ' + fmt(b.paid) + ' · SHARE ' + fmt(b.share), bx+bw*0.34, hy, 13, 'left', bw*0.66 - 230);
    else txt(ctx, 'PAID ' + fmt(b.paid), bx+bw*0.40, hy, 14);
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

  return c;
}
const canvasBlob = (c, type, q) => new Promise(res => c.toBlob(res, type, q));

/* One-page PDF holding the picture as a JPEG, written by hand so it works offline with no library. */
async function canvasPdf(c){
  const jpg = new Uint8Array(await (await canvasBlob(c, 'image/jpeg', 0.92)).arrayBuffer());
  const w = c.width / 2, h = c.height / 2;          // page size in points = picture size in CSS px
  const enc = new TextEncoder(), parts = [], offs = [];
  let len = 0;
  const put = x => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length; };
  const obj = (body, stream) => {
    offs.push(len);
    put(`${offs.length} 0 obj\n${body}\n`);
    if (stream){ put('stream\n'); put(stream); put('\nendstream\n'); }
    put('endobj\n');
  };
  const draw = enc.encode(`q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`);
  put('%PDF-1.4\n');
  obj('<</Type/Catalog/Pages 2 0 R>>');
  obj('<</Type/Pages/Kids[3 0 R]/Count 1>>');
  obj(`<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${w} ${h}]/Resources<</XObject<</Im0 4 0 R>>>>/Contents 5 0 R>>`);
  obj(`<</Type/XObject/Subtype/Image/Width ${c.width}/Height ${c.height}/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length ${jpg.length}>>`, jpg);
  obj(`<</Length ${draw.length}>>`, draw);
  const xref = len;
  put(`xref\n0 ${offs.length + 1}\n0000000000 65535 f \n` + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join(''));
  put(`trailer\n<</Size ${offs.length + 1}/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts, {type: 'application/pdf'});
}

/* ---------- layout: snap-to-grid dashboard, saved in this browser ----------
   Panels and friend cards sit on a 12-column grid with 8px rows. Each block has a stored box {x, y, w, h}
   (h = 0 means "as tall as its content"); blocks fall upward to fill gaps and never overlap. */
const COLS = 12, ROW = 8, LAYOUT_KEY = 'sdm-layout';
const defPanels = () => ({friends:{x:0, y:0, w:12, h:0}, results:{x:0, y:1, w:12, h:0}});
const defCard = (i, last) => ({x:(i % 3) * 4, y:last ? 1e6 : i, w:4, h:0});
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const goodBox = b => b && ['x','y','w','h'].every(k => Number.isFinite(b[k]));
function loadLayout(){
  const l = {panels: defPanels(), cards: []};
  try {
    const s = JSON.parse(localStorage.getItem(LAYOUT_KEY));
    if (s && s.panels) for (const k in l.panels) if (goodBox(s.panels[k])) l.panels[k] = s.panels[k];
    if (s && Array.isArray(s.cards)) l.cards = s.cards.map((b, i) => goodBox(b) ? b : defCard(i));
  } catch(e){}
  return l;
}
const saveLayout = () => { try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)); } catch(e){} };
let layout = loadLayout();
const cardBox = i => layout.cards[i] || (layout.cards[i] = defCard(i));

const GRIDS = {
  cols: {el: colsEl, gap: 22, minPx: 280,
         items: () => [...colsEl.querySelectorAll(':scope > .friend')].map(el => ({el, box: cardBox(+el.dataset.p)}))},
  main: {el: boardEl, gap: 28, minPx: 320,
         items: () => [...boardEl.querySelectorAll(':scope > [data-panel]')].map(el => ({el, box: layout.panels[el.dataset.panel]}))}
};
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
// place blocks in reading order, each one as high as it fits; the block being dragged goes first on ties.
// When the grid is too narrow for some block's chosen width, all blocks get equal columns instead.
function pack(its, minW, pinned){
  const forced = its.some(it => it.box.w < minW), per = Math.floor(COLS / minW), fw = Math.floor(COLS / per);
  its.forEach(it => { it.h = Math.max(it.box.h, it.need); });
  its.sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x || (a.box === pinned ? -1 : b.box === pinned ? 1 : 0));
  its.forEach((it, j) => {
    it.w = forced ? fw : clamp(it.box.w, minW, COLS);
    it.x = forced ? (j % per) * fw : clamp(it.box.x, 0, COLS - it.w);
  });
  const placed = [];
  for (const it of its){
    it.y = 0;
    for (let hit; (hit = placed.find(p => overlap(p, it))); ) it.y = hit.y + hit.h;
    placed.push(it);
  }
  return its;
}
function layoutAll(){
  for (let pass = 0; pass < 4; pass++){            // repeat while a width change alters some block's height
    let changed = false;
    for (const key of ['cols', 'main']){
      const g = GRIDS[key], its = g.items();
      const step = (g.el.clientWidth + g.gap) / COLS;
      const minW = clamp(Math.ceil((g.minPx + g.gap) / step), 1, COLS);
      its.forEach(it => {
        const cs = getComputedStyle(it.el);
        const natural = it.el.querySelector(':scope > .gi-in').offsetHeight + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
        it.need = Math.ceil((natural + g.gap) / ROW);
      });
      pack(its, minW, drag && drag.key === key ? drag.box : null).forEach(it => {
        const pos = `${it.x + 1} / span ${it.w}|${it.y + 1} / span ${it.h}`;
        if (it.el.dataset.pos !== pos){
          it.el.dataset.pos = pos;
          [it.el.style.gridColumn, it.el.style.gridRow] = pos.split('|');
          changed = true;
        }
        if (!drag) it.box.y = it.y;               // keep the stored order tidy
      });
    }
    if (!changed) break;
  }
  boardEl.classList.add('ready');
  if (drag) followDrag();
}
let layoutFrame = 0;
function relayout(){ cancelAnimationFrame(layoutFrame); layoutFrame = requestAnimationFrame(layoutAll); }

let drag = null;        // {key, el, box, mode: 'move'|'size', off, px, py, ph}
function followDrag(){
  const {el, ph} = drag;
  [ph.style.gridColumn, ph.style.gridRow] = [el.style.gridColumn, el.style.gridRow];
  if (drag.mode !== 'move') return;
  el.style.transform = '';
  const r = el.getBoundingClientRect();
  el.style.transform = `translate(${drag.px - drag.off.x - r.left}px, ${drag.py - drag.off.y - r.top}px)`;
}
document.addEventListener('pointerdown', e => {
  const h = e.target.closest('.grip, .sizer');
  if (!h || e.button !== 0) return;
  const el = h.closest('.friend, [data-panel]'), key = el.classList.contains('friend') ? 'cols' : 'main';
  const box = key === 'cols' ? cardBox(+el.dataset.p) : layout.panels[el.dataset.panel];
  const r = el.getBoundingClientRect();
  const ph = document.createElement('div'); ph.className = 'gph';
  GRIDS[key].el.appendChild(ph);
  drag = {key, el, box, mode: h.classList.contains('grip') ? 'move' : 'size', off: {x: e.clientX - r.left, y: e.clientY - r.top}, px: e.clientX, py: e.clientY, ph};
  el.classList.add('dragging'); document.body.classList.add('is-dragging');
  h.setPointerCapture(e.pointerId);
  e.preventDefault();
  getSelection().removeAllRanges();
  layoutAll();
});
document.addEventListener('pointermove', e => {
  if (!drag) return;
  const g = GRIDS[drag.key], gr = g.el.getBoundingClientRect(), step = (g.el.clientWidth + g.gap) / COLS;
  drag.px = e.clientX; drag.py = e.clientY;
  if (drag.mode === 'move'){
    drag.box.x = clamp(Math.round((e.clientX - drag.off.x - gr.left) / step), 0, COLS - 1);
    drag.box.y = Math.round((e.clientY - drag.off.y - gr.top) / ROW);
  } else {
    const r = drag.el.getBoundingClientRect();
    drag.box.w = clamp(Math.round((e.clientX - r.left + g.gap) / step), 1, COLS);
    drag.box.h = Math.max(1, Math.round((e.clientY - r.top + g.gap) / ROW));
  }
  layoutAll();
});
function endDrag(){
  if (!drag) return;
  drag.el.style.transform = '';
  drag.el.classList.remove('dragging'); document.body.classList.remove('is-dragging');
  drag.ph.remove();
  drag = null;
  layoutAll(); saveLayout();
}
document.addEventListener('pointerup', endDrag);
document.addEventListener('selectstart', e => { if (drag) e.preventDefault(); });
document.addEventListener('pointercancel', endDrag);
$('layout-reset').addEventListener('click', () => {
  layout = {panels: defPanels(), cards: people.map((_, i) => defCard(i))};
  saveLayout(); layoutAll();
});
boardEl.querySelectorAll('[data-panel]').forEach(p => p.insertAdjacentHTML('beforeend',
  `<button class="px M btn grip" type="button" title="Drag to move" aria-label="Move this block">${ICON_GRIP}</button><span class="sizer" title="Drag to resize">${ICON_SIZE}</span>`));
window.addEventListener('resize', relayout);
if (document.fonts) document.fonts.ready.then(relayout);

(async () => {
  if (!await loadFromHash()) people = Array.from({length:3}, newFriend);
  build();
})();   // open a shared link first, then draw
