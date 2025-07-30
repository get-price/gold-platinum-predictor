
// ===== Utilities =====
const JP_DOW = ["日","月","火","水","木","金","土"];
let currentKind = "dealer"; // 'dealer' | 'retail'
let currentMain = "today";  // 'today' | 'tomorrow' | 'colored'

const fmt = (n) => n == null ? "--" : n.toLocaleString('ja-JP');

function setDateAndTime(updatedISO) {
  const now = updatedISO ? new Date(updatedISO) : new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth()+1).padStart(2,'0');
  const d = String(now.getDate()).padStart(2,'0');
  const dow = JP_DOW[now.getDay()];
  document.querySelector('#today-date').textContent = `${y}-${m}-${d}（${dow}）`;
  const hh = String(now.getHours()).padStart(2,'0');
  const mm = String(now.getMinutes()).padStart(2,'0');
  document.querySelector('#updated-at').textContent = `更新: ${hh}:${mm}`;
}

// ===== Data fetch (predict.json) =====
let cache = null;
async function fetchData() {
  const res = await fetch('predict.json?ts=' + Date.now());
  if (!res.ok) return;
  const data = await res.json();
  cache = data;
  setDateAndTime(data.date ? (data.date + 'T00:00:00+09:00') : undefined);
  render();
}

// ===== Render for both sections =====
function render() {
  if (!cache) return;
  const goldDealer = Number(cache.gold?.price ?? 0);
  const goldPrev = goldDealer - Number(cache.gold?.diff ?? 0);
  const platDealer = Number(cache.platinum?.price ?? 0);
  const platPrev = platDealer - Number(cache.platinum?.diff ?? 0);

  const factor = currentKind === 'retail' ? 0.97 : 1.0;
  const gold = Math.round(goldDealer * factor);
  const goldPrevAdj = Math.round(goldPrev * factor);
  const goldDiffAdj = gold - goldPrevAdj;

  const plat = Math.round(platDealer * factor);
  const platPrevAdj = Math.round(platPrev * factor);
  const platDiffAdj = plat - platPrevAdj;

  // Today (with dealer/retail)
  assign('gold-price', `${fmt(gold)} 円`);
  setDiff('gold-diff', goldDiffAdj);
  assign('gold-prev', `${fmt(goldPrevAdj)} 円`);

  assign('platinum-price', `${fmt(plat)} 円`);
  setDiff('platinum-diff', platDiffAdj);
  assign('platinum-prev', `${fmt(platPrevAdj)} 円`);

  // Tomorrow (dealer only)
  assign('gold-price-tmr', `${fmt(Math.round(goldDealer))} 円`);
  setDiff('gold-diff-tmr', Math.round(goldDealer - goldPrev));
  assign('gold-prev-tmr', `${fmt(Math.round(goldPrev))} 円`);

  assign('platinum-price-tmr', `${fmt(Math.round(platDealer))} 円`);
  setDiff('platinum-diff-tmr', Math.round(platDealer - platPrev));
  assign('platinum-prev-tmr', `${fmt(Math.round(platPrev))} 円`);
}

function assign(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
function setDiff(id, diff) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = `(${diff >= 0 ? '+' : ''}${fmt(diff)} 円)`;
  el.classList.toggle('up', diff > 0);
  el.classList.toggle('down', diff < 0);
}

// ===== Main tabs (header) =====
function setMain(tab) {
  currentMain = tab;
  document.querySelectorAll('.pill-tab').forEach(a => {
    const is = a.dataset.main === tab;
    a.classList.toggle('is-active', is);
    a.setAttribute('aria-selected', is ? 'true' : 'false');
  });
  // Sections
  document.querySelectorAll('[data-section]').forEach(sec => {
    sec.style.display = (sec.getAttribute('data-section') === tab) ? '' : 'none';
  });
  // Subtabs visible only on "today"
  const subtabs = document.querySelector('[data-subtabs]');
  if (subtabs) subtabs.style.display = (tab === 'today') ? 'flex' : 'none';
}

document.addEventListener('DOMContentLoaded', () => {
  // Header main tabs
  document.querySelectorAll('.pill-tab').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      setMain(a.dataset.main);
      history.replaceState(null, '', '#' + a.dataset.main);
    });
  });
  // Subtabs (dealer/retail)
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentKind = btn.dataset.kind;
      render();
    });
  });

  // Initial
  const initial = (location.hash || '#today').replace('#','');
  setMain(initial);
  fetchData();
  setInterval(fetchData, 5 * 60 * 1000);
});
