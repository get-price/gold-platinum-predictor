
// Utility
const JP_DOW = ["日","月","火","水","木","金","土"];
const fmt = (n) => n == null ? "--" : Number(n).toLocaleString('ja-JP');

function formatYMDWithDow(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const da = String(d.getDate()).padStart(2,'0');
  const w = JP_DOW[d.getDay()];
  return `${y}-${m}-${da}（${w}）`;
}

function setClock() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2,'0');
  const mm = String(now.getMinutes()).padStart(2,'0');
  document.getElementById('meta-updated').textContent = `更新: ${hh}:${mm}`;
}

// Tabs
function showSection(name) {
  document.querySelectorAll('[data-section]').forEach(sec => {
    sec.hidden = (sec.dataset.section !== name);
  });
  document.querySelectorAll('.tab-link').forEach(a => {
    a.setAttribute('aria-selected', (a.dataset.tab === name) ? 'true' : 'false');
  });
  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  if (name === 'tomorrow') {
    document.getElementById('heading-text').textContent = '翌日の相場予想';
    document.getElementById('heading-date').textContent = formatYMDWithDow(tomorrow);
    document.getElementById('meta-date').textContent = formatYMDWithDow(tomorrow);
  } else if (name === 'today') {
    document.getElementById('heading-text').textContent = '本日の買取相場';
    document.getElementById('heading-date').textContent = formatYMDWithDow(today);
    document.getElementById('meta-date').textContent = formatYMDWithDow(today);
  } else {
    document.getElementById('heading-text').textContent = '色石相場';
    document.getElementById('heading-date').textContent = '';
    document.getElementById('meta-date').textContent = formatYMDWithDow(today);
  }
}

// Subtabs
let currentKind = 'dealer';
function setKind(kind) {
  currentKind = kind;
  document.querySelectorAll('.subtab').forEach(b => b.classList.toggle('is-active', b.dataset.kind === kind));
  renderTodayTables(cacheToday);
}

// Load prediction JSON (5-min refresh)
let cachePred = null;
async function loadPred() {
  const res = await fetch('data/predict_latest.json?ts=' + Date.now());
  if (!res.ok) return;
  const j = await res.json();
  cachePred = j;
  // gold
  document.getElementById('pred-gold-price').textContent = fmt(j.gold.price);
  document.getElementById('pred-gold-prev').textContent = fmt(j.gold.prev);
  const gdiff = j.gold.price - j.gold.prev;
  const gEl = document.getElementById('pred-gold-diff');
  gEl.textContent = (gdiff>=0?'+':'') + fmt(gdiff) + ' 円';
  gEl.classList.toggle('up', gdiff>0); gEl.classList.toggle('down', gdiff<0);

  // platinum
  document.getElementById('pred-pt-price').textContent = fmt(j.platinum.price);
  document.getElementById('pred-pt-prev').textContent = fmt(j.platinum.prev);
  const pdiff = j.platinum.price - j.platinum.prev;
  const pEl = document.getElementById('pred-pt-diff');
  pEl.textContent = (pdiff>=0?'+':'') + fmt(pdiff) + ' 円';
  pEl.classList.toggle('up', pdiff>0); pEl.classList.toggle('down', pdiff<0);
}

// Load today market JSON (09:45 daily)
let cacheToday = null;
async function loadToday() {
  const res = await fetch('data/today_market.json?ts=' + Date.now());
  if (!res.ok) return;
  const j = await res.json();
  cacheToday = j;
  renderTodayTables(j);
}

function renderRows(tbody, rows) {
  tbody.innerHTML = '';
  rows.forEach(([k, v]) => {
    const tr = document.createElement('tr');
    const td1 = document.createElement('td'); td1.textContent = k;
    const td2 = document.createElement('td'); td2.style.textAlign = 'right'; td2.textContent = fmt(v) + '円';
    tr.appendChild(td1); tr.appendChild(td2);
    tbody.appendChild(tr);
  });
}

function renderTodayTables(j) {
  if (!j) return;
  const factor = currentKind === 'retail' ? 0.98 : 1.0; // 表示は98%
  const titleDate = j.date_text || j.date;

  // Gold
  document.getElementById('gold-table-title').textContent = `${titleDate}の金買取価格一覧（税込）`;
  const gRows = Object.entries(j.gold).map(([k,v]) => [k, Math.round(v * factor)]);
  renderRows(document.querySelector('#gold-table tbody'), gRows);

  // Platinum
  document.getElementById('pt-table-title').textContent = `${titleDate}のプラチナ買取価格一覧（税込）`;
  const pRows = Object.entries(j.platinum).map(([k,v]) => [k, Math.round(v * factor)]);
  renderRows(document.querySelector('#pt-table tbody'), pRows);

  // Combo
  document.getElementById('combo-table-title').textContent = `${titleDate}の金・プラチナコンビ買取価格一覧`;
  const cRows = Object.entries(j.combo).map(([k,v]) => [k, Math.round(v * factor)]);
  renderRows(document.querySelector('#combo-table tbody'), cRows);

  // Silver
  document.getElementById('sv-table-title').textContent = `${titleDate}のシルバー買取価格一覧（税込）`;
  const sRows = Object.entries(j.silver).map(([k,v]) => [k, Math.round(v * factor)]);
  renderRows(document.querySelector('#sv-table tbody'), sRows);
}

document.addEventListener('DOMContentLoaded', () => {
  // Top tabs
  document.querySelectorAll('.tab-link').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      showSection(a.dataset.tab);
    });
  });
  // Subtabs
  document.querySelectorAll('.subtab').forEach(b => {
    b.addEventListener('click', () => setKind(b.dataset.kind));
  });

  showSection('tomorrow');
  setKind('dealer');
  loadPred();
  loadToday();
  setClock();
  setInterval(setClock, 60*1000);
  setInterval(loadPred, 5*60*1000); // 5-min
});
