
// ===== Utilities =====
const JP_DOW = ["日","月","火","水","木","金","土"];
const fmt = (n) => (n==null? "--" : Number(n).toLocaleString('ja-JP'));
function ymdWithDow(d){ const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),da=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${da}（${JP_DOW[d.getDay()]}）`; }
function nowJST(){ const n=new Date(); return n; }

// ===== Heading / Date / Clock =====
function setHeading(mode){
  const h1 = document.getElementById('heading-text');
  const h1Date = document.getElementById('heading-date');
  const metaDate = document.getElementById('meta-date');
  const now = nowJST();
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // today 00:00
  const tomorrow = new Date(base.getTime() + 24*60*60*1000);
  if(mode==='tomorrow'){
    if(h1) h1.textContent = '翌日の相場予想';
    if(h1Date) h1Date.textContent = ymdWithDow(tomorrow);
    if(metaDate) metaDate.textContent = ymdWithDow(tomorrow);
  }else if(mode==='today'){
    if(h1) h1.textContent = '本日の買取相場';
    if(h1Date) h1Date.textContent = ymdWithDow(base);
    if(metaDate) metaDate.textContent = ymdWithDow(base);
  }else{
    if(h1) h1.textContent = '色石相場';
    if(h1Date) h1Date.textContent = '';
    if(metaDate) metaDate.textContent = ymdWithDow(base);
  }
}
function setClock(){ const el=document.getElementById('updated-at'); const n=nowJST(); const hh=String(n.getHours()).padStart(2,'0'); const mm=String(n.getMinutes()).padStart(2,'0'); if(el) el.textContent=`更新: ${hh}:${mm}`; }

// ===== Data loaders =====
async function safeFetch(url){
  try{
    const res = await fetch(url + (url.includes('?')?'&':'?') + 'ts=' + Date.now());
    if(!res.ok) throw new Error(res.statusText);
    return await res.json();
  }catch(e){
    console.error('Fetch failed', url, e);
    return null;
  }
}

// Tomorrow prediction
async function loadPredict(){
  const status = document.getElementById('predict-status');
  const data = await safeFetch('./data/predict_latest.json');
  if(!data){ if(status) status.textContent='データ取得できません'; return; }
  if(status) status.textContent = '5分ごとに自動更新';
  // Gold
  const gprice = data.gold?.price ?? null;
  const gdiff  = data.gold?.diff ?? null;
  document.getElementById('gold-price').textContent = `${fmt(gprice)} 円`;
  const gd = document.getElementById('gold-diff');
  if(gd){ gd.textContent = `(${gdiff>=0?'+':''}${fmt(gdiff)} 円)`; gd.classList.toggle('up', gdiff>0); gd.classList.toggle('down', gdiff<0); }
  // Platinum
  const pprice = data.platinum?.price ?? null;
  const pdiff  = data.platinum?.diff ?? null;
  document.getElementById('platinum-price').textContent = `${fmt(pprice)} 円`;
  const pd = document.getElementById('platinum-diff');
  if(pd){ pd.textContent = `(${pdiff>=0?'+':''}${fmt(pdiff)} 円)`; pd.classList.toggle('up', pdiff>0); pd.classList.toggle('down', pdiff<0); }
}

// Today market
let todayKind = 'dealer'; // dealer | retail
function setTodayKind(k){ todayKind = k; document.querySelectorAll('.subtab').forEach(x=>x.classList.toggle('active', x.dataset.kind===k)); renderToday(window.__todayData); }
function renderToday(data){
  if(!data) return;
  const factor = (todayKind==='retail') ? 0.98 : 1.0; // 一般向け=98%
  const tbody = document.getElementById('today-tbody');
  if(!tbody) return;
  tbody.innerHTML = '';
  (data.items||[]).forEach(row => {
    const tr = document.createElement('tr');
    const price = Math.round((row.price_jpy_g || 0) * factor);
    tr.innerHTML = `<td>${row.category}</td><td>${row.fineness}</td><td style="text-align:right">${fmt(price)} 円/g</td>`;
    tbody.appendChild(tr);
  });
}
async function loadToday(){
  const status = document.getElementById('today-status');
  const data = await safeFetch('./data/today_market.json');
  if(!data){ if(status) status.textContent='データ取得できません'; return; }
  if(status) status.textContent='毎朝 9:45 に自動更新（色石バンクの98%を表示）';
  window.__todayData = data;
  renderToday(data);
}

// Hash/tab routing
function applyFromHash(){
  const hash = (location.hash||'#tomorrow').toLowerCase();
  const mode = hash.includes('today') ? 'today' : hash.includes('stones') ? 'stones' : 'tomorrow';
  document.querySelectorAll('.tab-link').forEach(a=>{
    const active = a.getAttribute('href') === '#' + mode;
    a.classList.toggle('is-active', active);
    a.setAttribute('aria-selected', active ? 'true':'false');
  });
  ['tomorrow','today','stones'].forEach(sec => {
    const el = document.querySelector(`[data-section="${sec}"]`);
    if(el) el.style.display = (sec===mode)?'':'none';
  });
  setHeading(mode);
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  // top tabs click
  document.querySelectorAll('.tab-link').forEach(a => {
    a.addEventListener('click', (e)=>{ e.preventDefault(); const href=a.getAttribute('href'); history.replaceState(null,'',href); applyFromHash(); });
  });
  // today subtabs
  document.querySelectorAll('.subtab').forEach(btn => {
    btn.addEventListener('click', ()=> setTodayKind(btn.dataset.kind));
  });
  applyFromHash();
  setClock();
  setInterval(setClock, 60*1000);

  // load data
  loadPredict();
  setInterval(loadPredict, 5*60*1000);
  loadToday();
});
