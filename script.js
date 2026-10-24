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
let nextId = 1;
// ord = position in the ledger (new entries go last)
const newExp = (o = {}) => { const id = nextId++; return {id, ord: id, amt:'', why:'', skip:[], date:'', time:'', ...o}; };
// date 'YYYY-MM-DD' and time 'HH:MM' are both optional ('' = not given)
let people = [];        // [{name, exps:[{id, amt, why, skip:[friend indices left out], date, time, open}]}]
let transfers = [];     // paid back: [{id, ord, from, to, amt, why, date, time}]
const isBlank = e => e.amt === '' && e.why === '';
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
         <button class="px M btn grip" type="button" title="Drag to move (or use the arrow keys)" aria-label="Move ${esc(nameOf(i))}">${ICON_GRIP}</button>
         ${n > MIN_FRIENDS ? `<button class="px M btn rmf" type="button" title="Remove this friend" aria-label="Remove ${esc(nameOf(i))}">${ICON_RM}</button>` : ''}
       </span></div><div class="px M field"><input class="nm" placeholder="Friend ${i+1}" value="${esc(p.name)}"></div></div>
       <div><label>Paid (₹) &amp; reason</label>
         <div class="exps">${p.exps.map((e,j) =>
           `<div class="exp" data-e="${j}">
              <div class="px M field f-am"><input class="am" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0" value="${esc(e.amt)}"></div>
              <div class="px M field f-wy"><input class="wy" placeholder="Reason (optional)" value="${esc(e.why)}"></div>
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
       ${transfers.some(t => t.from === i && t.to < n) ? `<div><label>Paid back</label><div class="pbs">${transfers.filter(t => t.from === i && t.to < n).map(t =>
         `<div class="px M pb" data-t="${t.id}"><span>&rarr; ${esc(nameOf(t.to))}${t.why.trim() ? ` <i>${esc(t.why.trim())}</i>` : ''}</span><b>${fmt(toPaise(t.amt))}</b>
            <button class="px M btn rmt" type="button" title="Delete this payment" aria-label="Delete payment">${ICON_RM}</button></div>`).join('')}</div></div>` : ''}
       <button class="px M btn add" type="button">+ Add expense</button>
       <div class="sub" id="sub${i}"></div>
       <div class="px M chip" id="bal${i}"></div>
       </div>`;
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
  // money paid back between friends moves balances but is not spending
  const sent = Array(n).fill(0), got = Array(n).fill(0);
  transfers.forEach(t => { const a = toPaise(t.amt); if (a && t.from !== t.to && t.from < n && t.to < n){ sent[t.from] += a; got[t.to] += a; } });
  const moved = sent.reduce((a,b) => a+b, 0), active = total || moved;
  const bal = paid.map((p,i) => p - share[i] + sent[i] - got[i]);              // + gets back, - has to pay

  bal.forEach((b,i) => {
    if (!$('sub'+i)) return;
    $('sub'+i).textContent = [paid[i] ? `Total paid: ${fmt(paid[i])}` : '', uneven ? `Share: ${fmt(share[i])}` : '',
                              sent[i] ? `Paid back: ${fmt(sent[i])}` : '', got[i] ? `Got back: ${fmt(got[i])}` : ''].filter(Boolean).join(' · ');
    const el = $('bal'+i);
    if (!active){ el.className = 'px M chip'; el.textContent = ''; }
    else if (b > 0){ el.className = 'px M chip gets'; el.textContent = `Gets back ${fmt(b)}`; }
    else if (b < 0){ el.className = 'px M chip pays'; el.textContent = `Needs to pay ${fmt(-b)}`; }
    else { el.className = 'px M chip'; el.textContent = 'All good'; }
  });

  const sum = $('summary');
  sum.hidden = !active;
  sum.textContent = (uneven
    ? `Total spent ${fmt(total)}. Some expenses leave friends out, so shares differ (see each friend).`
    : `Total spent ${fmt(total)}. Each friend's fair share: ${fmt(total / n)}.`) + (moved ? ` ${fmt(moved)} already paid back.` : '');

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
  if (!active) ul.innerHTML = '<li class="px M">Type the amounts above.</li>';
  else if (!out.length) ul.innerHTML = `<li class="px M">${moved ? 'All settled up!' : 'Everyone paid the same. Nothing to settle!'}</li>`;
  else ul.innerHTML = out.map(t =>
    `<li class="px M t"><span class="who">${esc(nameOf(t.from))}</span> gives <span class="who to">${esc(nameOf(t.to))}</span><span class="amt">${fmt(t.v)}</span></li>`).join('');

  last = {n, paid, total, share, uneven, bal, out, sent, got, active};
  updateExportMenu();
  scheduleSync();
}

/* ---------- share link: the whole state lives in the URL hash ---------- */
const b64 = bytes => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
                       return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); };
const unb64 = t => { t = t.replace(/-/g,'+').replace(/_/g,'/'); while (t.length % 4) t += '=';
                     const s = atob(t), a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; };
const pipe = async (bytes, stream) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());

// dates travel as 'YYYYMMDD' and times as 'HHMM' to keep links short
const packD = d => d.replace(/-/g, ''), packT = t => t.replace(':', '');
function stateArray(){
  const n = count(), pos = new Map(ledgerRows().map((r, i) => [r.id, i]));
  return [n, people.slice(0, n).map(p => [
    p.name,
    p.exps.filter(e => !isBlank(e)).map(e => [e.amt, e.why, [...e.skip].sort((a,b) => a-b), packD(e.date), packT(e.time), pos.get(e.id)])
  ]), transfers.map(t => [t.from, t.to, t.amt, t.why, packD(t.date), packT(t.time), pos.get(t.id)])];
}
const hasData = () => { const s = stateArray(); return s[1].some(p => p[0].trim() || p[1].length) || s[2].length > 0; };

async function encodeState(){
  const raw = new TextEncoder().encode(JSON.stringify(stateArray()));
  try { if (typeof CompressionStream === 'function') return 'z' + b64(await pipe(raw, new CompressionStream('deflate-raw'))); } catch(e){}
  return 'r' + b64(raw);
}
async function decodeState(code){
  let bytes = unb64(code.slice(1));
  if (code[0] === 'z') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
  else if (code[0] !== 'r') throw new Error('unknown format');
  const [n, list, tlist] = JSON.parse(new TextDecoder().decode(bytes));
  // older links stored a time in minutes since 1970 (0 = none); newer ones store 'YYYYMMDD' + 'HHMM'
  const when = (d, t) => {
    if (typeof d === 'number') return d > 0 ? splitAt(d * 60000) : {date:'', time:''};
    d = String(d || ''); t = String(t || '');
    return {date: /^\d{8}$/.test(d) ? `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6)}` : '', time: /^\d{4}$/.test(t) ? `${t.slice(0,2)}:${t.slice(2)}` : ''};
  };
  const cl = (v, m) => String(v == null ? '' : v).slice(0, m);
  const nn = Math.max(MIN_FRIENDS, Math.min(MAX_FRIENDS, parseInt(n, 10) || MIN_FRIENDS));
  const ppl = (Array.isArray(list) ? list : []).slice(0, nn).map(p => {
    const exps = (Array.isArray(p[1]) ? p[1] : []).slice(0, 200).map(e => newExp({amt: cl(e[0], 20), why: cl(e[1], 200),
      skip: [...new Set((Array.isArray(e[2]) ? e[2] : []).map(Number).filter(q => Number.isInteger(q) && q >= 0 && q < nn))], ...when(e[3], e[4]), ord: Number.isInteger(e[5]) ? e[5] : null}));
    return {name: cl(p[0], 100), exps: exps.length ? exps : [newExp()]};
  });
  while (ppl.length < nn) ppl.push(newFriend());
  const okIdx = v => Number.isInteger(v) && v >= 0 && v < nn;
  const tr = (Array.isArray(tlist) ? tlist : []).slice(0, 500).filter(t => Array.isArray(t) && okIdx(t[0]) && okIdx(t[1]) && t[0] !== t[1])
    .map(t => ({id: nextId++, from: t[0], to: t[1], amt: cl(t[2], 20), why: cl(t[3], 200), ...when(t[4], t[5]), ord: Number.isInteger(t[6]) ? t[6] : null}));
  // links from before rows could be reordered: put them in date order, as the ledger showed them then
  const all = [...ppl.flatMap(p => p.exps.filter(e => !isBlank(e))), ...tr];
  if (all.some(x => x.ord === null)) all.sort(byDate).forEach((x, i) => x.ord = i);
  ppl.forEach(p => p.exps.forEach(e => { if (e.ord === null) e.ord = e.id; }));
  return {n: nn, people: ppl, transfers: tr};
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
  showPreview('link', code);
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

/* ---------- look: playful (pixel art) or formal. Saved in this browser only, never in the share link ---------- */
const LOOK_KEY = 'sdm-look';
let siteLook = document.documentElement.classList.contains('formal') ? 'formal' : 'fun';
function setLook(v){
  siteLook = v;
  document.documentElement.classList.toggle('formal', v === 'formal');
  $('look').checked = v === 'formal';
  try { localStorage.setItem(LOOK_KEY, v); } catch(e){}
}
$('look').checked = siteLook === 'formal';
$('look').addEventListener('change', e => setLook(e.target.checked ? 'formal' : 'fun'));

/* ---------- preview before copying / downloading ---------- */
// what the open preview will copy / download: {kind, code, url} for a link, else {kind, file, name} plus
// a picture to show (blob, url) or a table to show (html)
let pv = null;
const PV_TEXT = {
  link: ['Preview link', 'Copy link'], png: ['Preview picture', 'Download'], pdf: ['Preview PDF', 'Download PDF'],
  'lg-png': ['Preview ledger picture', 'Download'], 'lg-pdf': ['Preview ledger PDF', 'Download PDF'],
  csv: ['Preview ledger CSV', 'Download CSV'], xlsx: ['Preview ledger Excel file', 'Download Excel']
};
const STYLED = ['png', 'pdf', 'lg-png', 'lg-pdf', 'xlsx'];   // exports that can be drawn playful or formal
function showPreview(kind, data){
  closePreview();
  const isLink = kind === 'link';
  pv = isLink ? {kind, code: data, url: ''} : {kind, ...data, url: data.blob ? URL.createObjectURL(data.blob) : ''};
  [$('pv-title').textContent, $('pv-go').textContent] = PV_TEXT[kind];
  $('pv-go').disabled = false;
  $('pv-look').hidden = !STYLED.includes(kind);
  document.querySelectorAll('#pv-look input').forEach(r => r.checked = r.value === pv.style);
  $('pv-link').hidden = !isLink;
  $('pv-img').hidden = !pv.blob;
  $('pv-table').hidden = !pv.html;
  $('pv-table').innerHTML = pv.html || '';
  if (isLink){
    $('pv-base').value = base.kind;
    $('pv-custom').value = base.custom;
    updateLinkPreview();
  } else if (pv.blob){
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
  $('pv-img').classList.remove('busy');
  $('pv-pic').removeAttribute('src');
  if ($('pv').open) $('pv').close();
}
$('pv-go').addEventListener('click', async () => {
  const cur = pv; if (!cur) return;
  if (cur.kind === 'link'){ if (!cur.url) return; await doCopyLink(cur.url); }
  else downloadBlob(cur.file, cur.name);
  closePreview();
});
// switching the style redraws the open preview in place
let lookRun = 0;
$('pv-look').addEventListener('change', async e => {
  const cur = pv, run = ++lookRun, style = e.target.value;
  if (!cur || !STYLED.includes(cur.kind)) return;
  $('pv-go').disabled = true; $('pv-img').classList.add('busy');
  const d = await buildExport(cur.kind, style);
  if (pv !== cur || run !== lookRun) return;            // closed, or switched again meanwhile
  $('pv-go').disabled = false; $('pv-img').classList.remove('busy');
  if (cur.blob) URL.revokeObjectURL(cur.url);
  Object.assign(cur, d, {style, url: d.blob ? URL.createObjectURL(d.blob) : ''});
  if (cur.blob) $('pv-pic').src = cur.url;
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
    people = s.people; transfers = s.transfers;
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
  } else if (e.target.closest('.pb .rmt')){
    const id = +e.target.closest('.pb').dataset.t;
    transfers = transfers.filter(t => t.id !== id);
    build();
  } else if (e.target.closest('.rmf')){
    if (people.length <= MIN_FRIENDS) return;
    people.splice(pi, 1);
    people.forEach(q => q.exps.forEach(ex => ex.skip = ex.skip.filter(x => x !== pi).map(x => x > pi ? x - 1 : x)));
    const before = transfers.length, shift = x => x > pi ? x - 1 : x;
    transfers = transfers.filter(t => t.from !== pi && t.to !== pi).map(t => ({...t, from: shift(t.from), to: shift(t.to)}));
    if (transfers.length < before) toast(`Also removed ${before - transfers.length} paid-back ${before - transfers.length === 1 ? 'entry' : 'entries'} with this friend.`);
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
  build({p:i, name:true});
});
$('reset').addEventListener('click', () => { people.forEach(p => p.exps = [newExp()]); transfers = []; build(); });
$('link').addEventListener('click', copyLink);
window.addEventListener('hashchange', async () => { if (await loadFromHash()){ build(); renderLedger(); } });

/* ---------- export menu: everything that downloads lives here ---------- */
const menuEl = $('export-list'), menuBtn = $('export-menu');
function updateExportMenu(){
  const noSplit = !last || !last.active, noLedger = !ledgerRows().length;
  menuEl.querySelectorAll('[data-x]').forEach(b => {
    const x = b.dataset.x;
    b.disabled = x === 'png' || x === 'pdf' ? noSplit : x === 'settings' ? false : noLedger;
  });
}
function openMenu(open){
  menuEl.hidden = !open;
  menuBtn.setAttribute('aria-expanded', open);
  if (open){ updateExportMenu(); const first = menuEl.querySelector('button:not(:disabled)'); if (first) first.focus(); }
}
menuBtn.addEventListener('click', () => openMenu(menuEl.hidden));
document.addEventListener('click', e => { if (!menuEl.hidden && !e.target.closest('#export-wrap')) openMenu(false); });
menuEl.addEventListener('keydown', e => {
  const items = [...menuEl.querySelectorAll('button:not(:disabled)')], i = items.indexOf(document.activeElement);
  if (e.key === 'Escape'){ openMenu(false); menuBtn.focus(); }
  else if (e.key === 'ArrowDown' || e.key === 'ArrowUp'){
    e.preventDefault();
    items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus();
  }
});
menuEl.addEventListener('click', e => {
  const b = e.target.closest('[data-x]'); if (!b || b.disabled) return;
  openMenu(false);
  const x = b.dataset.x;
  if (x === 'settings'){ drawExportSettings(); $('xs').showModal(); }
  else startExport(x);
});

/* ---------- pages: Split and Ledger share the same data ---------- */
const TAB_KEY = 'sdm-tab';
function showTab(t){
  document.querySelectorAll('.tab').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === t));
  $('page-split').hidden = t !== 'split';
  $('page-ledger').hidden = t !== 'ledger';
  if (t !== 'split') openLayoutMenu(false);
  if (t === 'split') build(); else renderLedger();
  try { localStorage.setItem(TAB_KEY, t); } catch(e){}
}
document.querySelector('.tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) showTab(b.dataset.tab); });

/* ---------- ledger: one table row per expense or payment ---------- */
const TYPES = [['exp', 'Expense'], ['for', 'Paid for'], ['back', 'Paid back']];
const typeName = t => TYPES.find(x => x[0] === t)[1];
const z2 = v => String(v).padStart(2, '0');
function splitAt(ms){ const d = new Date(ms); return {date: `${d.getFullYear()}-${z2(d.getMonth()+1)}-${z2(d.getDate())}`, time: `${z2(d.getHours())}:${z2(d.getMinutes())}`}; }
const fmtDate = d => d ? new Date(d + 'T00:00').toLocaleDateString(undefined, {day:'numeric', month:'short', year:'numeric'}) : '';
const everyone = () => Array.from({length: count()}, (_, q) => q);
const otherThan = i => i === 0 ? 1 : 0;

function findEntry(id){
  for (let p = 0; p < people.length; p++){
    const j = people[p].exps.findIndex(e => e.id === id);
    if (j >= 0) return {kind:'e', p, j, e: people[p].exps[j]};
  }
  const k = transfers.findIndex(t => t.id === id);
  return k >= 0 ? {kind:'t', k, t: transfers[k]} : null;
}
// the ledger's view of an entry: {id, type, by, to:[friends], amt, why, at}
function rowOf(f){
  if (f.kind === 't') return {id: f.t.id, ord: f.t.ord, type:'back', by: f.t.from, to:[f.t.to], amt: f.t.amt, why: f.t.why, date: f.t.date, time: f.t.time};
  const s = sharers(f.e, count());
  return {id: f.e.id, ord: f.e.ord, type: s.length === 1 && s[0] !== f.p ? 'for' : 'exp', by: f.p, to: s, amt: f.e.amt, why: f.e.why, date: f.e.date, time: f.e.time};
}
function ledgerRows(){
  const rows = [];
  people.forEach((p, i) => p.exps.forEach((e, j) => { if (!isBlank(e)) rows.push(rowOf({kind:'e', p:i, j, e})); }));
  transfers.forEach((t, k) => rows.push(rowOf({kind:'t', k, t})));
  return rows.sort((a, b) => a.ord - b.ord || a.id - b.id);
}
// "Sort by date": dated entries first in date and time order, undated ones after in their current order
const dateKey = r => r.date ? r.date + ' ' + (r.time || '') : '~';
const byDate = (a, b) => dateKey(a) < dateKey(b) ? -1 : dateKey(a) > dateKey(b) ? 1 : (a.ord ?? a.id) - (b.ord ?? b.id);
function setOrder(ids){ ids.forEach((id, i) => { const f = findEntry(id); if (f) (f.kind === 'e' ? f.e : f.t).ord = i; }); }
const forText = r => r.type === 'exp' && r.to.length === count() ? 'Everyone' : r.to.map(nameOf).join(', ');
// keep a row sensible: "Paid for" / "Paid back" need one other friend, "Expense" needs somebody
function tidy(r){
  if (r.type === 'exp'){ if (!r.to.length) r.to = everyone(); }
  else { const t = r.to.find(q => q !== r.by); r.to = [t === undefined ? otherThan(r.by) : t]; }
  return r;
}
function dropExp(p, j){ const ex = people[p].exps; ex.splice(j, 1); if (!ex.length) ex.push(newExp()); }
function addExp(p, e){
  const ex = people[p].exps;
  if (ex.length && isBlank(ex[ex.length - 1])) ex.splice(ex.length - 1, 0, e); else ex.push(e);
  if (ex.length === 2 && isBlank(ex[1]) && ex[0] === e) ex.pop();    // a friend's lone empty line is replaced
}
// write a ledger row back into the Split data (moving it between friends or between expense and payment)
function saveRow(r){
  tidy(r);
  const f = findEntry(r.id);
  if (r.type === 'back'){
    const t = {id: r.id, ord: r.ord, from: r.by, to: r.to[0], amt: r.amt, why: r.why, date: r.date, time: r.time};
    if (f && f.kind === 't') transfers[f.k] = t;
    else { if (f) dropExp(f.p, f.j); transfers.push(t); }
    return;
  }
  const fields = {ord: r.ord, amt: r.amt, why: r.why, date: r.date, time: r.time, skip: everyone().filter(q => !r.to.includes(q))};
  if (f && f.kind === 'e' && f.p === r.by){ Object.assign(f.e, fields); return; }
  const e = f && f.kind === 'e' ? Object.assign(f.e, fields) : newExp({...fields, id: r.id});
  if (f) f.kind === 'e' ? dropExp(f.p, f.j) : transfers.splice(f.k, 1);
  addExp(r.by, e);
}
function deleteEntry(id){
  const f = findEntry(id); if (!f) return;
  if (f.kind === 'e') dropExp(f.p, f.j); else transfers.splice(f.k, 1);
}

let draft = null;        // the "new entry" row
const newDraft = (keep = {}) => tidy({id: 'new', type: keep.type || 'exp', by: Math.min(keep.by || 0, count() - 1), to: keep.type && keep.type !== 'exp' ? (keep.to || []) : everyone(),
                                      amt:'', why:'', date:'', time:''});
function lgRow(r){
  const isNew = r.id === 'new', n = count();
  const opt = (v, label, sel) => `<option value="${v}"${sel ? ' selected' : ''}>${esc(label)}</option>`;
  const target = r.type === 'exp'
    ? `<div class="tags" role="group" aria-label="Split between">${everyone().map(q => {
        const on = r.to.includes(q);
        return `<button class="px M btn tag c${q%4}${on ? '' : ' off'}" type="button" data-q="${q}" aria-pressed="${on}" title="${esc(nameOf(q))}${on ? '' : ' (left out)'}">${esc(tagText(q))}</button>`;
      }).join('')}</div>`
    : `<div class="px M field"><select class="lg-to" aria-label="${r.type === 'back' ? 'Paid back to' : 'Paid for'}">${
        everyone().filter(q => q !== r.by).map(q => opt(q, nameOf(q), q === r.to[0])).join('')}</select></div>`;
  const clr = (f, label) => r[f] ? `<button class="px M btn clr lg-clr" type="button" data-f="${f}" title="Remove the ${label}" aria-label="Remove the ${label}">${ICON_RM}</button>` : '';
  return `<tr data-id="${r.id}"${isNew ? ' class="lg-new"' : ''}>
    <td class="mv">${isNew ? '' : `<button class="px M btn grip" type="button" title="Drag to move (or use the arrow keys)" aria-label="Move this row">${ICON_GRIP}</button>`}</td>
    <td><div class="dt"><div class="px M field"><input class="lg-date" type="date" value="${esc(r.date)}" aria-label="Date (optional)"></div>${clr('date', 'date')}</div></td>
    <td><div class="dt"><div class="px M field"><input class="lg-time" type="time" value="${esc(r.time)}" aria-label="Time (optional)"></div>${clr('time', 'time')}</div></td>
    <td><div class="px M field"><select class="lg-type" aria-label="Type">${TYPES.map(([v, l]) => opt(v, l, v === r.type)).join('')}</select></div></td>
    <td><div class="px M field"><select class="lg-by" aria-label="Paid by">${everyone().map(q => opt(q, nameOf(q), q === r.by)).join('')}</select></div></td>
    <td><div class="px M field"><input class="lg-amt" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0" value="${esc(r.amt)}" aria-label="Amount"></div></td>
    <td>${target}</td>
    <td><div class="px M field"><input class="lg-why" placeholder="${isNew ? 'Note (optional)' : '—'}" value="${esc(r.why)}" aria-label="Note"></div></td>
    <td>${isNew ? '<button class="px M btn blue lg-add" type="button">Add</button>'
               : `<button class="px M btn rmt lg-del" type="button" title="Delete entry" aria-label="Delete entry">${ICON_RM}</button>`}</td>
  </tr>`;
}
function renderLedger(focus){
  if (!draft || draft.by >= count()) draft = newDraft(draft || {});
  tidy(draft);
  $('lg-new').innerHTML = lgRow(draft);
  const rows = ledgerRows();
  $('lg-body').innerHTML = rows.length ? rows.map(lgRow).join('')
    : '<tr class="lg-empty"><td colspan="9">No entries yet. Add one above, or type amounts on the Split page.</td></tr>';
  ledgerTotals(rows);
  if (focus){
    const el = document.querySelector(`#page-ledger tr[data-id="${focus.id}"] ${focus.sel}`);
    if (el) el.focus();
  }
}
// paid back, added up for each pair of friends: [{from, to, amt}]
function paidBackPairs(rows){
  const m = new Map();
  rows.filter(r => r.type === 'back').forEach(r => { const k = r.by + '>' + r.to[0]; m.set(k, (m.get(k) || 0) + toPaise(r.amt)); });
  return [...m].filter(([, a]) => a).map(([k, amt]) => { const [from, to] = k.split('>').map(Number); return {from, to, amt}; });
}
function ledgerTotals(rows = ledgerRows()){
  const spent = rows.filter(r => r.type !== 'back').reduce((s, r) => s + toPaise(r.amt), 0);
  const pairs = paidBackPairs(rows);
  $('lg-total').innerHTML = `${rows.length} ${rows.length === 1 ? 'entry' : 'entries'} · Total spent ${fmt(spent)}` +
    (pairs.length ? `<span class="pbk">Paid back: ${pairs.map(p => `${esc(nameOf(p.from))} → ${esc(nameOf(p.to))} ${fmt(p.amt)}`).join(' · ')}</span>` : '');
}
$('lg-sort').addEventListener('click', () => {
  setOrder(ledgerRows().sort(byDate).map(r => r.id));
  calc(); renderLedger();
});
const rowFrom = el => {
  const tr = el.closest('tr[data-id]'); if (!tr) return null;
  if (tr.dataset.id === 'new') return draft;
  const f = findEntry(+tr.dataset.id);
  return f ? rowOf(f) : null;
};
const ledgerEl = $('page-ledger');
ledgerEl.addEventListener('input', e => {
  const r = rowFrom(e.target); if (!r) return;
  if (e.target.classList.contains('lg-amt')) r.amt = e.target.value;
  else if (e.target.classList.contains('lg-why')) r.why = e.target.value;
  else return;
  if (r !== draft){ saveRow(r); calc(); ledgerTotals(); }
});
ledgerEl.addEventListener('change', e => {
  const t = e.target, r = rowFrom(t); if (!r) return;
  const cls = ['lg-date', 'lg-time', 'lg-type', 'lg-by', 'lg-to'].find(c => t.classList.contains(c)); if (!cls) return;
  if (cls === 'lg-date') r.date = t.value;
  if (cls === 'lg-time') r.time = t.value;
  if (cls === 'lg-type'){ r.type = t.value; if (r.type === 'exp') r.to = everyone(); }
  if (cls === 'lg-by') r.by = +t.value;
  if (cls === 'lg-to') r.to = [+t.value];
  if (r !== draft){ saveRow(r); calc(); } else tidy(r);
  renderLedger({id: r.id, sel: '.' + cls});
});
ledgerEl.addEventListener('click', e => {
  const tag = e.target.closest('.tag'), del = e.target.closest('.lg-del'), add = e.target.closest('.lg-add'), clr = e.target.closest('.lg-clr');
  if (!tag && !del && !add && !clr) return;
  const r = rowFrom(e.target); if (!r) return;
  if (clr){
    r[clr.dataset.f] = '';
    if (r !== draft){ saveRow(r); calc(); }
    renderLedger({id: r.id, sel: '.lg-' + clr.dataset.f});
  } else if (tag){
    const q = +tag.dataset.q;
    if (r.to.includes(q)){ if (r.to.length === 1) return toast('At least one friend has to share this expense.'); r.to = r.to.filter(x => x !== q); }
    else r.to = [...r.to, q].sort((a, b) => a - b);
    if (r !== draft){ saveRow(r); calc(); }
    renderLedger({id: r.id, sel: `.tag[data-q="${q}"]`});
  } else if (del){
    deleteEntry(r.id); calc(); renderLedger();
  } else addDraft();
});
ledgerEl.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.closest('.lg-new') && e.target.matches('input')) addDraft(); });
function addDraft(){
  if (!(toPaise(draft.amt) > 0)){ toast('Type an amount first.'); document.querySelector('.lg-new .lg-amt').focus(); return; }
  saveRow({...draft, id: nextId, ord: nextId}); nextId++;
  draft = newDraft(draft);
  calc(); renderLedger({id: 'new', sel: '.lg-amt'});
}

/* ---------- export as picture (drawn on a canvas, works offline) ---------- */
// two looks: 'fun' = pixel art like the page, 'formal' = clean sans-serif with soft rounded cards
const LOOKS = {
  fun: {pixel: true, upper: true, star: '★ ', font: '"Space Mono","Courier New",monospace', bold: 700,
        ink: '#2b2118', sub: '#6b5d4a', line: '#2b2118', bg: '#f5e6bc', bar: '#f2bf5e', foot: '#e8808f', footInk: '#2b2118',
        yellow: '#f5c542', cyan: '#3cc4cf', sage: '#c9e0a6', peach: '#f6c878', cream: '#fff7e0', zebra: '#f7ebc6',
        green: '#8fdc7a', red: '#e2503a', gInk: '#2b2118', rInk: '#ffffff', back: '#2f7a3a', cards: ['#f8dc8f','#c3e8ec','#f6c9b6','#e6efc9'], xlHead: 'FF3CC4CF'},
  formal: {pixel: false, upper: false, star: '', font: '"Inter","Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif', bold: 600,
        ink: '#101828', sub: '#667085', line: '#e4e7ec', bg: '#f6f7f9', bar: '#ffffff', foot: '#ffffff', footInk: '#98a2b3', accent: '#4f46e5',
        yellow: '#eef2ff', cyan: '#f9fafb', sage: '#ffffff', peach: '#ffffff', cream: '#ffffff', zebra: '#f9fafb',
        green: '#ecfdf3', red: '#fef3f2', gInk: '#067647', rInk: '#b42318', back: '#067647', cards: ['#f9fafb','#f9fafb','#f9fafb','#f9fafb'], xlHead: 'FFF2F4F7'}
};
let lk = LOOKS.fun;      // the look being drawn right now
const U = s => lk.upper ? s.toUpperCase() : s;
const font = size => `${lk.bold} ${size}px ${lk.font}`;
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
  if (!lk.pixel){                                   // formal: 1px grey border, rounded corners, soft shadow on big cards
    const r = kind === 'M' ? 8 : 16;
    ctx.save();
    if (kind !== 'M'){ ctx.shadowColor = 'rgba(16,24,40,.08)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 2; }
    ctx.fillStyle = lk.line; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
    ctx.restore();
    ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x+1, y+1, w-2, h-2, r-1); ctx.fill();
    return;
  }
  const b = kind === 'M' ? 2 : 4, n = kind === 'M' ? 4 : 3;
  fillPoly(ctx, poly(x, y, w, h, b, n), lk.ink);
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
  ctx.font = font(size);
  ctx.fillStyle = color || lk.ink; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(maxW ? fit(ctx, text, maxW) : text, x, y);
}
// section title: a blue pixel pill, or a plain heading when formal (both 38px tall)
function pill(ctx, label, x, y){
  if (!lk.pixel) return txt(ctx, label, x, y + 19, 18);
  ctx.font = font(15);
  box(ctx, x, y, ctx.measureText(label).width + 36, 38, lk.cyan, 'L');
  txt(ctx, label, x + 18, y + 20, 15);
}
// page background, 88px header with the title and date, 52px footer
function frame(ctx, W, H, pad){
  const rule = lk.pixel ? 4 : 1;
  ctx.fillStyle = lk.bg; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = lk.bar; ctx.fillRect(0, 0, W, 88);
  ctx.fillStyle = lk.line; ctx.fillRect(0, 88 - rule, W, rule);
  let tx = pad;
  if (lk.accent){                                   // formal: a small rupee logo before the title
    ctx.fillStyle = lk.accent; ctx.beginPath(); ctx.roundRect(pad, 27, 34, 34, 10); ctx.fill();
    txt(ctx, '₹', pad + 17, 45, 19, 'center', 0, '#ffffff');
    tx += 46;
  }
  txt(ctx, lk.star + U('Split-da-money'), tx, 44, W < 700 ? 24 : lk.pixel ? 30 : 28);
  txt(ctx, new Date().toLocaleDateString(undefined, {day:'numeric', month:'short', year:'numeric'}), W-pad, 44, 15, 'right', 0, lk.pixel ? lk.ink : lk.sub);
  ctx.fillStyle = lk.foot; ctx.fillRect(0, H-52, W, 52);
  ctx.fillStyle = lk.line; ctx.fillRect(0, H-52, W, rule);
  txt(ctx, U('Split-da-money'), W/2, H-24, 13, 'center', 0, lk.footInk);
}

// open the preview of an export, drawn in the page's current look (the preview can switch it)
async function startExport(x){
  if ((x === 'png' || x === 'pdf') ? !last || !last.active : !ledgerRows().length) return;
  const style = siteLook;
  showPreview(x, {...await buildExport(x, style), style});
}
// what an export contains: {file, name} plus a picture (blob) or a table (html) to preview
async function buildExport(x, style){
  if (x === 'png' || x === 'pdf'){
    const c = await renderPicture(style), blob = await canvasBlob(c, 'image/png');
    return {blob, file: x === 'pdf' ? await canvasPdf(c) : blob, name: 'split-da-money.' + x};
  }
  const rows = ledgerTable();
  if (x === 'lg-png' || x === 'lg-pdf'){
    const c = await renderLedgerPicture(rows, style), blob = await canvasBlob(c, 'image/png');
    return {blob, file: x === 'lg-pdf' ? await canvasPdf(c) : blob, name: 'split-da-money-ledger.' + x.slice(3)};
  }
  const html = `<table class="ledger plain"><thead><tr>${LG_HEAD.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${
    rows.map(r => `<tr><td>${esc(r.date)}</td><td>${esc(r.time)}</td><td>${esc(r.type)}</td><td>${esc(r.by)}</td><td class="num">${(r.amt/100).toFixed(2)}</td><td>${esc(r.to)}</td><td>${esc(r.why)}</td></tr>`).join('')
  }</tbody></table>`;
  return {html, file: x === 'csv' ? ledgerCsv(rows) : ledgerXlsx(rows, style), name: 'split-da-money-ledger.' + x};
}
function downloadBlob(blob, name){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ---------- ledger exports: picture, PDF, CSV and Excel (all written here, so they work offline) ---------- */
function ledgerTable(){
  return ledgerRows().map(r => ({date: r.date, time: r.time, type: typeName(r.type), by: nameOf(r.by), amt: toPaise(r.amt), to: forText(r), why: r.why.trim()}));
}
const LG_HEAD = ['Date', 'Time', 'Type', 'Paid by', 'Amount (₹)', 'For / to', 'Note'];
function ledgerCsv(rows){
  const cell = v => /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  const lines = [LG_HEAD, ...rows.map(r => [r.date, r.time, r.type, r.by, (r.amt/100).toFixed(2), r.to, r.why])].map(l => l.map(v => cell(String(v))).join(','));
  return new Blob(['\ufeff' + lines.join('\r\n') + '\r\n'], {type: 'text/csv;charset=utf-8'});   // BOM so Excel reads UTF-8
}

// .xlsx = a zip of a few XML files; stored without compression, which every spreadsheet app accepts
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++){ let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function zipStore(files){
  const enc = new TextEncoder(), parts = [], central = [];
  let off = 0;
  const le = (n, bytes) => { const a = new Uint8Array(bytes); for (let i = 0; i < bytes; i++) a[i] = (n >>> (8*i)) & 255; return a; };
  for (const [name, text] of files){
    const nm = enc.encode(name), data = enc.encode(text), crc = crc32(data);
    const head = [le(0x04034b50,4), le(20,2), le(0x0800,2), le(0,2), le(0,2), le(0x21,2), le(crc,4), le(data.length,4), le(data.length,4), le(nm.length,2), le(0,2)];
    central.push([le(0x02014b50,4), le(20,2), le(20,2), le(0x0800,2), le(0,2), le(0,2), le(0x21,2), le(crc,4), le(data.length,4), le(data.length,4),
                  le(nm.length,2), le(0,2), le(0,2), le(0,2), le(0,2), le(0,4), le(off,4), nm]);
    for (const b of [...head, nm, data]){ parts.push(b); off += b.length; }
  }
  const cdStart = off; let cdLen = 0;
  central.flat().forEach(b => { parts.push(b); cdLen += b.length; });
  parts.push(le(0x06054b50,4), le(0,2), le(0,2), le(files.length,2), le(files.length,2), le(cdLen,4), le(cdStart,4), le(0,2));
  return new Blob(parts, {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
function ledgerXlsx(rows, style){
  const head = (LOOKS[style] || LOOKS.fun).xlHead;      // header row fill
  const x = v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const col = i => String.fromCharCode(65 + i);
  const str = (r, i, v, st) => `<c r="${col(i)}${r}" t="inlineStr"${st ? ` s="${st}"` : ''}><is><t xml:space="preserve">${x(v)}</t></is></c>`;
  const num = (r, i, v, st) => `<c r="${col(i)}${r}" s="${st}"><v>${v}</v></c>`;
  // Excel dates are days since 1899-12-30; a time is a fraction of a day
  const daySerial = d => (Date.UTC(+d.slice(0,4), +d.slice(5,7) - 1, +d.slice(8,10)) - Date.UTC(1899, 11, 30)) / 864e5;
  const timeSerial = t => (+t.slice(0,2) * 60 + +t.slice(3,5)) / 1440;
  const total = rows.filter(r => r.type !== 'Paid back').reduce((s, r) => s + r.amt, 0);
  const body = [
    `<row r="1">${LG_HEAD.map((h, i) => str(1, i, h, 1)).join('')}</row>`,
    ...rows.map((r, k) => { const n = k + 2;
      return `<row r="${n}">${r.date ? num(n, 0, daySerial(r.date), 2) : str(n, 0, '')}${r.time ? num(n, 1, timeSerial(r.time).toFixed(10), 5) : str(n, 1, '')}${str(n, 2, r.type)}${str(n, 3, r.by)}${num(n, 4, (r.amt/100).toFixed(2), 3)}${str(n, 5, r.to)}${str(n, 6, r.why)}</row>`; }),
    `<row r="${rows.length + 2}">${str(rows.length + 2, 3, 'Total spent', 1)}${num(rows.length + 2, 4, (total/100).toFixed(2), 4)}</row>`,
    ...paidBackPairs(ledgerRows()).map((p, k) => { const n = rows.length + 3 + k;
      return `<row r="${n}">${str(n, 3, 'Paid back', 1)}${num(n, 4, (p.amt/100).toFixed(2), 4)}${str(n, 5, nameOf(p.from) + ' → ' + nameOf(p.to))}</row>`; })
  ].join('');
  const widths = [12, 8, 12, 16, 14, 28, 36];
  return zipStore([
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Ledger" sheetId="1" r:id="rId1"/></sheets></workbook>'],
    ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
    ['xl/styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="3"><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/><numFmt numFmtId="165" formatCode="&quot;₹&quot;#,##0.00"/><numFmt numFmtId="166" formatCode="hh:mm"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="' + head + '"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/><xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'],
    ['xl/worksheets/sheet1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths.map((w, i) => `<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${body}</sheetData></worksheet>`]
  ]);
}

async function renderLedgerPicture(rows, style){
  lk = LOOKS[style] || LOOKS.fun;
  try { await document.fonts.load(font(16)); } catch(e){}
  const W = xo.width === 'wide' ? 1200 : 900, pad = 28, S = 2, inner = W - 2*pad, gap = 28;
  const bx = pad + 26, bw = inner - 52, rowH = 38, headH = 40, pillH = 38;
  const COLS_LG = [['Date', .15], ['Time', .08], ['Type', .12], ['Paid by', .14], ['Amount', .13, 'right'], ['For / to', .18], ['Note', .20]];
  const tableH = headH + rows.length * rowH;
  const spent = rows.filter(r => r.type !== 'Paid back').reduce((s, r) => s + r.amt, 0);
  const pairs = paidBackPairs(ledgerRows()), footH = 40 + 24 * pairs.length;
  const panelH = 22 + pillH + 18 + tableH + 16 + footH + 24;
  const H = 88 + gap + panelH + gap + 52;
  const c = document.createElement('canvas');
  c.width = W*S; c.height = H*S;
  const ctx = c.getContext('2d'); ctx.scale(S, S);
  frame(ctx, W, H, pad);

  let y = 88 + gap;
  box(ctx, pad, y, inner, panelH, lk.sage, 'L');
  pill(ctx, U('Ledger'), bx, y + 22);
  const ty = y + 22 + pillH + 18;
  box(ctx, bx, ty, bw, tableH + 8, lk.cream, 'M');
  const cx = []; let acc = bx + 4;
  COLS_LG.forEach(([, f]) => { cx.push(acc); acc += (bw - 8) * f; });
  ctx.fillStyle = lk.cyan; ctx.fillRect(bx + 4, ty + 4, bw - 8, headH);
  ctx.fillStyle = lk.line; ctx.fillRect(bx + 4, ty + 4 + headH - 2, bw - 8, 2);
  COLS_LG.forEach(([h, f, al], i) => {
    const w = (bw - 8) * f;
    txt(ctx, U(h), al === 'right' ? cx[i] + w - 12 : cx[i] + 12, ty + 4 + headH/2, 12, al, w - 20);
  });
  rows.forEach((r, k) => {
    const ry = ty + 4 + headH + k * rowH;
    if (k % 2){ ctx.fillStyle = lk.zebra; ctx.fillRect(bx + 4, ry, bw - 8, rowH); }
    const vals = [fmtDate(r.date) || '—', r.time || '—', r.type, r.by, fmt(r.amt), r.to, r.why || '—'];
    vals.forEach((v, i) => {
      const [, f, al] = COLS_LG[i], w = (bw - 8) * f;
      txt(ctx, v, al === 'right' ? cx[i] + w - 12 : cx[i] + 12, ry + rowH/2 + 1, 13, al, w - 20, i === 2 && r.type === 'Paid back' ? lk.back : lk.ink);
    });
  });
  const fy = ty + tableH + 8 + 16;
  box(ctx, bx, fy, bw, footH, lk.yellow, 'M');
  txt(ctx, U(`${rows.length} ${rows.length === 1 ? 'entry' : 'entries'}  ·  Total spent ${fmt(spent)}`), bx + 16, fy + 21, 13, 'left', bw - 32);
  pairs.forEach((p, k) => txt(ctx, `${U('Paid back')}  ${nameOf(p.from)} → ${nameOf(p.to)}  ${fmt(p.amt)}`, bx + 16, fy + 21 + 24*(k+1), 13, 'left', bw - 32));
  return c;
}

/* ---------- export settings: which sections, their order, width and cards per row (saved in this browser) ---------- */
const EXPORT_KEY = 'sdm-export';
const SECTIONS = {summary: 'Summary (total & share)', paid: 'Who paid what', settle: 'Settlement'};
const WIDTHS = {narrow: 600, normal: 900, wide: 1200};
const defExport = () => ({order: ['summary', 'paid', 'settle'], on: {summary: true, paid: true, settle: true}, lines: true, width: 'normal', cols: 1});
let xo = defExport();
try {
  const s = JSON.parse(localStorage.getItem(EXPORT_KEY));
  if (s){
    const d = defExport();
    if (Array.isArray(s.order) && s.order.length === 3 && d.order.every(k => s.order.includes(k))) d.order = s.order;
    if (s.on) for (const k in d.on) if (typeof s.on[k] === 'boolean') d.on[k] = s.on[k];
    if (typeof s.lines === 'boolean') d.lines = s.lines;
    if (WIDTHS[s.width]) d.width = s.width;
    if ([1,2,3,4].includes(s.cols)) d.cols = s.cols;
    xo = d;
  }
} catch(e){}
const saveExport = () => { try { localStorage.setItem(EXPORT_KEY, JSON.stringify(xo)); } catch(e){} };

function drawExportSettings(){
  $('xs-sections').innerHTML = xo.order.map((k, i) =>
    `<li class="px M xs-row" data-k="${k}">
       <label class="xs-check"><input type="checkbox" ${xo.on[k] ? 'checked' : ''}> ${SECTIONS[k]}</label>
       <button class="px M btn xs-up" type="button" title="Move up" aria-label="Move ${SECTIONS[k]} up" ${i ? '' : 'disabled'}>${ICON_OPEN}</button>
       <button class="px M btn xs-down" type="button" title="Move down" aria-label="Move ${SECTIONS[k]} down" ${i < xo.order.length - 1 ? '' : 'disabled'}>${ICON_OPEN}</button>
     </li>`).join('');
  $('xs-lines').checked = xo.lines;
  $('xs-lines').disabled = !xo.on.paid;
  document.querySelectorAll('#xs input[name="xs-width"]').forEach(r => r.checked = r.value === xo.width);
  document.querySelectorAll('#xs input[name="xs-cols"]').forEach(r => { r.checked = +r.value === xo.cols; r.disabled = !xo.on.paid; });
}
$('xs-done').addEventListener('click', () => $('xs').close());
$('xs').addEventListener('click', e => { if (e.target === $('xs')) $('xs').close(); });
$('xs-reset').addEventListener('click', () => { xo = defExport(); saveExport(); drawExportSettings(); });
$('xs-sections').addEventListener('click', e => {
  const row = e.target.closest('.xs-row'), btn = e.target.closest('.xs-up, .xs-down');
  if (!row || !btn) return;
  const i = xo.order.indexOf(row.dataset.k), j = i + (btn.classList.contains('xs-up') ? -1 : 1);
  [xo.order[i], xo.order[j]] = [xo.order[j], xo.order[i]];
  saveExport(); drawExportSettings();
  const r = $('xs-sections').querySelector(`[data-k="${row.dataset.k}"]`), dir = btn.classList.contains('xs-up') ? '.xs-up' : '.xs-down';
  const again = r.querySelector(dir).disabled ? r.querySelector(dir === '.xs-up' ? '.xs-down' : '.xs-up') : r.querySelector(dir);
  again.focus();
});
$('xs').addEventListener('change', e => {
  const t = e.target;
  if (t.closest('.xs-row')){
    const k = t.closest('.xs-row').dataset.k;
    if (!t.checked && xo.order.filter(q => xo.on[q]).length === 1){ t.checked = true; return toast('Keep at least one section in the export.'); }
    xo.on[k] = t.checked;
  } else if (t.id === 'xs-lines') xo.lines = t.checked;
  else if (t.name === 'xs-width') xo.width = t.value;
  else if (t.name === 'xs-cols') xo.cols = +t.value;
  saveExport(); drawExportSettings();
});

async function renderPicture(style){
  lk = LOOKS[style] || LOOKS.fun;
  try { await document.fonts.load(font(16)); } catch(e){}
  const {n, paid, total, share, uneven, bal, out} = last;

  // what each person paid (only lines with an amount)
  const blocks = people.slice(0, n).map((p, i) => ({
    i, name: nameOf(i), paid: paid[i], share: share[i], bal: bal[i],
    rows: !xo.lines ? [] : p.exps.filter(e => toPaise(e.amt) > 0).map(e => {
      const out = skipped(e, n).length && sharers(e, n).length < n ? skipped(e, n) : [];
      return {why: (e.why || '').trim() || '—', note: out.length ? '{not for ' + out.map(nameOf).join(', ') + '}' : '', amt: toPaise(e.amt)};
    }).concat(!xo.lines ? [] : transfers.filter(t => t.from === i && t.to < n && toPaise(t.amt) > 0)
      .map(t => ({why: 'Paid back to ' + nameOf(t.to), note: (t.why || '').trim(), amt: toPaise(t.amt)})))
  }));

  const W = WIDTHS[xo.width], pad = 28, S = 2, inner = W - 2*pad, gap = 28;
  const pillH = 38, panelTop = 22, panelBottom = 24;
  const rowH = 52, cardGap = 16;
  const bx = pad + 26, bw = inner - 52;
  const cols = Math.max(1, Math.min(xo.cols, blocks.length));
  const colW = (bw - cardGap*(cols-1)) / cols;
  const compact = colW < 600;                       // narrow cards: name + chip on one line, amounts below
  const headH = compact ? 12 + 34 + 40 + 24 + (uneven ? 22 : 0) : 12 + 38;
  const lineOf = r => r.note ? 52 : 32;
  const blockH = b => headH + (b.rows.length ? b.rows.reduce((s, r) => s + lineOf(r), 0) + 6 : 0) + 14;
  const grid = [];
  for (let k = 0; k < blocks.length; k += cols) grid.push(blocks.slice(k, k + cols));
  const lineH = grid.map(r => Math.max(...r.map(blockH)));
  const expH = panelTop + pillH + 18 + lineH.reduce((s,h) => s + h, 0) + cardGap*(grid.length-1) + panelBottom;
  const payRows = Math.max(1, out.length);
  const payH = panelTop + pillH + 18 + payRows*rowH - 8 + panelBottom;
  const heights = {summary: 88, paid: expH, settle: payH};
  const shown = xo.order.filter(k => xo.on[k]);
  const H = 88 + gap + shown.reduce((s,k) => s + heights[k] + gap, 0) + 52;

  const c = document.createElement('canvas');
  c.width = W*S; c.height = H*S;
  const ctx = c.getContext('2d');
  ctx.scale(S, S);
  frame(ctx, W, H, pad);

  const draw = {
    summary(y){
      box(ctx, pad, y, inner, 88, lk.yellow, 'L');
      const big = W < 700 ? 22 : 26;
      txt(ctx, U('Total spent'), pad+30, y+32, 13);
      txt(ctx, fmt(total), pad+30, y+60, big, 'left', inner/2 - 40);
      if (uneven){
        txt(ctx, U('Fair shares'), W/2+10, y+32, 13);
        txt(ctx, 'Differ per friend', W/2+10, y+60, W < 700 ? 15 : 18, 'left', inner/2 - 40);
      } else {
        txt(ctx, U('Each friend should pay'), W/2+10, y+32, 13, 'left', inner/2 - 40);
        txt(ctx, fmt(Math.round(total / n)), W/2+10, y+60, big, 'left', inner/2 - 40);
      }
    },
    paid(y){
      box(ctx, pad, y, inner, expH, lk.sage, 'L');
      pill(ctx, U('Who paid what'), bx, y + panelTop);
      let by = y + panelTop + pillH + 18;
      grid.forEach((line, li) => {
        line.forEach((b, ci) => drawBlock(b, bx + ci*(colW + cardGap), by, colW, lineH[li]));
        by += lineH[li] + cardGap;
      });
    },
    settle(y){
      box(ctx, pad, y, inner, payH, lk.peach, 'L');
      pill(ctx, U('Settlement'), bx, y + panelTop);
      let ry = y + panelTop + pillH + 18;
      if (!out.length){
        box(ctx, bx, ry, bw, rowH-8, lk.cream, 'M');
        txt(ctx, 'Everyone paid the same. Nothing to settle!', bx+18, ry+(rowH-8)/2+1, 15, 'left', bw-36);
      } else out.forEach(t => {
        const aw = Math.min(170, bw*0.3), ax = bx + bw - aw - 8;
        box(ctx, bx, ry, bw, rowH-8, lk.cream, 'M');
        txt(ctx, `${nameOf(t.from)}  gives  ${nameOf(t.to)}`, bx+18, ry+(rowH-8)/2+1, 16, 'left', bw - aw - 40);
        box(ctx, ax, ry+5, aw, rowH-18, lk.yellow, 'M');
        txt(ctx, fmt(t.v), ax+aw/2, ry+(rowH-8)/2+1, 15, 'center', aw-12);
        ry += rowH;
      });
    }
  };
  function drawBlock(b, x, y, w, h){
    box(ctx, x, y, w, h, lk.cards[b.i % 4], 'M');
    const hy = y + 12 + 19;
    const lab = U(b.bal > 0 ? 'Gets ' + fmt(b.bal) : b.bal < 0 ? 'Pays ' + fmt(-b.bal) : 'All good');
    const col = b.bal > 0 ? lk.green : b.bal < 0 ? lk.red : lk.cream;
    ctx.font = font(13);
    const cw = compact ? Math.min(ctx.measureText(lab).width + 32, w - 40) : 200, cx = compact ? x + 20 : x + w - cw - 14;
    const money = U(uneven ? 'Paid ' + fmt(b.paid) + ' · Share ' + fmt(b.share) : 'Paid ' + fmt(b.paid));
    let cy = hy;                                     // middle of the GETS / PAYS chip
    if (compact){                                    // narrow card: name, chip, then the amounts, one per line
      cy = y + 12 + 34 + 17;
      txt(ctx, b.name, x+20, y + 12 + 17, 17, 'left', w - 40);
      txt(ctx, U('Paid ') + fmt(b.paid), x+20, cy + 34, 13, 'left', w - 40);
      if (uneven) txt(ctx, U('Share ') + fmt(b.share), x+20, cy + 56, 13, 'left', w - 40);
    } else {
      txt(ctx, b.name, x+20, hy, 17, 'left', w*0.30);
      txt(ctx, money, x+w*0.34, hy, 13, 'left', w*0.66 - cw - 40);
    }
    box(ctx, cx, cy - 16, cw, 32, col, 'M');
    txt(ctx, lab, cx+cw/2, cy+1, 13, 'center', cw-16, b.bal > 0 ? lk.gInk : b.bal < 0 ? lk.rInk : lk.ink);
    let ry = y + headH + 2;
    b.rows.forEach(r => {
      const cy = ry + 15, amt = fmt(r.amt);
      ctx.font = font(15);
      const aw = ctx.measureText(amt).width;
      ctx.fillStyle = lk.ink; ctx.fillRect(x+22, cy-3, 6, 6);
      txt(ctx, r.why, x+38, cy, 15, 'left', w - 38 - 20 - aw - 18);
      txt(ctx, amt, x+w-20, cy, 15, 'right');
      if (r.note) txt(ctx, r.note, x+38, cy + 21, 12, 'left', w - 38 - 20, lk.sub);
      ry += lineOf(r);
    });
  }

  let y = 88 + gap;
  shown.forEach(k => { draw[k](y); y += heights[k] + gap; });
  return c;
}
const canvasBlob = (c, type, q) => new Promise(res => c.toBlob(res, type, q));

/* PDF holding the picture as JPEG pages, written by hand so it works offline with no library.
   Page size in points = picture size in CSS px; very tall pictures are cut into pages (PDF pages max out at 14400pt). */
async function canvasPdf(c){
  const S = 2, W = c.width / S, H = c.height / S, MAXH = 14000;
  const pages = [];
  for (let top = 0; top < H; top += MAXH){
    const h = Math.min(MAXH, H - top);
    let src = c;
    if (top || h < H){
      src = document.createElement('canvas'); src.width = c.width; src.height = Math.round(h * S);
      src.getContext('2d').drawImage(c, 0, Math.round(top * S), c.width, src.height, 0, 0, c.width, src.height);
    }
    pages.push({w: W, h, px: src.width, py: src.height, jpg: new Uint8Array(await (await canvasBlob(src, 'image/jpeg', 0.92)).arrayBuffer())});
  }
  const enc = new TextEncoder(), parts = [], offs = [];
  let len = 0;
  const put = x => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length; };
  const obj = (num, body, stream) => {
    offs[num - 1] = len;
    put(`${num} 0 obj\n${body}\n`);
    if (stream){ put('stream\n'); put(stream); put('\nendstream\n'); }
    put('endobj\n');
  };
  // objects: 1 catalog, 2 page tree, then 3 per page (page, image, drawing)
  put('%PDF-1.4\n');
  obj(1, '<</Type/Catalog/Pages 2 0 R>>');
  obj(2, `<</Type/Pages/Kids[${pages.map((_, i) => `${3 + i*3} 0 R`).join(' ')}]/Count ${pages.length}>>`);
  pages.forEach((p, i) => {
    const n = 3 + i*3, draw = enc.encode(`q ${p.w} 0 0 ${p.h} 0 0 cm /Im0 Do Q`);
    obj(n, `<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${p.w} ${p.h}]/Resources<</XObject<</Im0 ${n+1} 0 R>>>>/Contents ${n+2} 0 R>>`);
    obj(n+1, `<</Type/XObject/Subtype/Image/Width ${p.px}/Height ${p.py}/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length ${p.jpg.length}>>`, p.jpg);
    obj(n+2, `<</Length ${draw.length}>>`, draw);
  });
  const xref = len;
  put(`xref\n0 ${offs.length + 1}\n0000000000 65535 f \n` + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join(''));
  put(`trailer\n<</Size ${offs.length + 1}/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts, {type: 'application/pdf'});
}

/* ---------- layout: drag the dotted handle to reorder friends and sections; the Layout menu picks
   stacked / side-by-side sections and friend cards per row. Saved in this browser. ---------- */
const LAYOUT_KEY = 'sdm-layout', LAYOUT_V = 3, PANELS = ['friends', 'results'];
const defLayout = () => ({v: LAYOUT_V, order: [...PANELS], side: false, per: 0});   // per 0 = as many as fit
function loadLayout(){
  const l = defLayout();
  try {
    const s = JSON.parse(localStorage.getItem(LAYOUT_KEY));
    if (s && s.v === LAYOUT_V){
      if (Array.isArray(s.order) && s.order.length === PANELS.length && PANELS.every(k => s.order.includes(k))) l.order = s.order;
      l.side = s.side === true;
      if ([0,1,2,3,4].includes(s.per)) l.per = s.per;
    }
  } catch(e){}
  return l;
}
const saveLayout = () => { try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)); } catch(e){} };
let layout = loadLayout();
function applyLayout(){
  layout.order.forEach(k => boardEl.appendChild(boardEl.querySelector(`[data-panel="${k}"]`)));
  boardEl.querySelectorAll('[data-panel] .pill[data-title]').forEach((p, i) => p.textContent = `${i + 1}. ${p.dataset.title}`);
  boardEl.classList.toggle('side', layout.side);
  boardEl.classList.toggle('res-first', layout.order[0] === 'results');
  colsEl.style.setProperty('--per', layout.per || 'auto');
  colsEl.classList.toggle('per', layout.per > 0);
  layoutMenu.querySelectorAll('[data-l]').forEach(b => {
    const [k, v] = b.dataset.l.split(':');
    if (k !== 'reset') b.setAttribute('aria-checked', k === 'side' ? String(layout.side) === v : String(layout.per) === v);
  });
}

// reorder friends: the people array itself moves, so links and exports keep the order
function reorderPeople(order){                      // order = old indices in their new order
  const to = []; order.forEach((old, neu) => to[old] = neu);
  people = order.map(i => people[i]);
  people.forEach(p => p.exps.forEach(e => e.skip = e.skip.map(q => to[q] ?? q)));
  transfers.forEach(t => { t.from = to[t.from]; t.to = to[t.to]; });
  draft = null;
}
function finishMove(list){
  if (list === $('lg-body')){
    setOrder([...list.children].map(tr => +tr.dataset.id));
    calc(); renderLedger();
  } else if (list === colsEl){
    const order = [...colsEl.children].map(el => +el.dataset.p);
    if (order.some((v, i) => v !== i)){ reorderPeople(order); build(); }
  } else {
    layout.order = [...boardEl.children].map(el => el.dataset.panel);
    saveLayout(); applyLayout();
  }
}
// where in the list the dragged block should go, given the pointer
function dropSpot(list, el, x, y){
  const across = getComputedStyle(list).gridTemplateColumns.split(' ').length > 1;
  for (const sib of list.children){
    if (sib === el) continue;
    const r = sib.getBoundingClientRect();
    if (y < r.top || y > r.bottom || x < r.left || x > r.right) continue;
    const after = across ? x > r.left + r.width/2 : y > r.top + r.height/2;
    return after ? sib.nextSibling : sib;
  }
  return undefined;
}
let drag = null;        // {el, list, id}
document.addEventListener('pointerdown', e => {
  const h = e.target.closest('.grip');
  if (!h || e.button !== 0) return;
  const el = h.closest('.friend, [data-panel], #lg-body > tr');
  drag = {el, list: el.parentElement, id: e.pointerId};
  el.classList.add('dragging'); document.body.classList.add('is-dragging');
  h.setPointerCapture(e.pointerId);
  e.preventDefault(); getSelection().removeAllRanges();
});
document.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  const spot = dropSpot(drag.list, drag.el, e.clientX, e.clientY);
  if (spot !== undefined && spot !== drag.el && spot !== drag.el.nextSibling) drag.list.insertBefore(drag.el, spot);
});
function endDrag(){
  if (!drag) return;
  drag.el.classList.remove('dragging'); document.body.classList.remove('is-dragging');
  const list = drag.list; drag = null;
  finishMove(list);
}
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', endDrag);
document.addEventListener('selectstart', e => { if (drag) e.preventDefault(); });
// keyboard: arrow keys on a handle move the block one place
document.addEventListener('keydown', e => {
  const h = e.target.closest && e.target.closest('.grip');
  if (!h || !['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) return;
  e.preventDefault();
  const el = h.closest('.friend, [data-panel], #lg-body > tr'), list = el.parentElement, back = e.key === 'ArrowUp' || e.key === 'ArrowLeft';
  const sib = back ? el.previousElementSibling : el.nextElementSibling;
  if (!sib) return;
  list.insertBefore(el, back ? sib : sib.nextSibling);
  const key = el.dataset.panel || null, row = el.dataset.id || null, pos = [...list.children].indexOf(el);
  finishMove(list);
  const again = key ? boardEl.querySelector(`[data-panel="${key}"] > .grip`)
              : row ? $('lg-body').querySelector(`tr[data-id="${row}"] .grip`) : colsEl.children[pos].querySelector('.grip');
  if (again) again.focus();
});

const layoutMenu = $('layout-list'), layoutBtn = $('layout-menu');
function openLayoutMenu(open){
  layoutMenu.hidden = !open; layoutBtn.setAttribute('aria-expanded', open);
  if (open) layoutMenu.querySelector('button').focus();
}
layoutBtn.addEventListener('click', () => openLayoutMenu(layoutMenu.hidden));
document.addEventListener('click', e => { if (!layoutMenu.hidden && !e.target.closest('#layout-wrap')) openLayoutMenu(false); });
layoutMenu.addEventListener('keydown', e => {
  const items = [...layoutMenu.querySelectorAll('button')], i = items.indexOf(document.activeElement);
  if (e.key === 'Escape'){ openLayoutMenu(false); layoutBtn.focus(); }
  else if (e.key === 'ArrowDown' || e.key === 'ArrowUp'){ e.preventDefault(); items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus(); }
});
layoutMenu.addEventListener('click', e => {
  const b = e.target.closest('[data-l]'); if (!b) return;
  const [k, v] = b.dataset.l.split(':');
  if (k === 'side') layout.side = v === 'true';
  else if (k === 'per') layout.per = +v;
  else layout = defLayout();
  saveLayout(); applyLayout();
});
boardEl.querySelectorAll('[data-panel]').forEach(p => p.insertAdjacentHTML('beforeend',
  `<button class="px M btn grip" type="button" title="Drag to move (or use the arrow keys)" aria-label="Move this section">${ICON_GRIP}</button>`));
applyLayout();

(async () => {
  if (!await loadFromHash()) people = Array.from({length:3}, newFriend);
  let tab = 'split';
  try { if (localStorage.getItem(TAB_KEY) === 'ledger') tab = 'ledger'; } catch(e){}
  showTab(tab);
  if (tab === 'ledger') build();       // the Split page is still drawn so its balances are ready
})();   // open a shared link first, then draw
