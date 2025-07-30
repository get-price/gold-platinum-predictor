
const JP_DOW = ["日","月","火","水","木","金","土"];
let currentKind = "dealer"; // 'dealer' | 'retail'

const fmt = (n) => n == null ? "--" : n.toLocaleString('ja-JP');

function setDateAndTime(updatedISO) {
  const now = updatedISO ? new Date(updatedISO) : new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth()+1).padStart(2,'0');
  const d = String(now.getDate()).padStart(2,'0');
  const dow = JP_DOW[now.getDay()];
  document.getElementById('today-date').textContent = `${y}-${m}-${d}（${dow}）`;
  const hh = String(now.getHours()).padStart(2,'0');
  const mm = String(now.getMinutes()).padStart(2,'0');
  document.getElementById('updated-at').textContent = `更新: ${hh}:${mm}`;
}

function applyKind(kind, data) {
  currentKind = kind;
  document.querySelectorAll('.tab').forEach(btn => btn.classList.toggle('active', btn.dataset.kind === kind));
  render(data);
}

let cache = null;

async function fetchData() {
  try {
    const res = await fetch('predict.json?ts=' + Date.now());
    if (!res.ok) throw new Error('predict.json not found');
    const data = await res.json();
    cache = data;
    setDateAndTime(data.date ? (data.date + 'T00:00:00+09:00') : undefined);
    render(data);
  } catch (e) {
    console.error(e);
  }
}

function render(data) {
  if (!data) return;
  const goldDealer = Number(data.gold?.price ?? 0);
  const goldPrev = goldDealer - Number(data.gold?.diff ?? 0);
  const platDealer = Number(data.platinum?.price ?? 0);
  const platPrev = platDealer - Number(data.platinum?.diff ?? 0);

  const factor = currentKind === 'retail' ? 0.97 : 1.0;
  const gold = Math.round(goldDealer * factor);
  const goldPrevAdj = Math.round(goldPrev * factor);
  const goldDiffAdj = gold - goldPrevAdj;

  const plat = Math.round(platDealer * factor);
  const platPrevAdj = Math.round(platPrev * factor);
  const platDiffAdj = plat - platPrevAdj;

  document.getElementById('gold-price').textContent = `${fmt(gold)} 円`;
  const gd = document.getElementById('gold-diff');
  gd.textContent = `(${goldDiffAdj >= 0 ? '+' : ''}${fmt(goldDiffAdj)} 円)`;
  gd.classList.toggle('up', goldDiffAdj > 0);
  gd.classList.toggle('down', goldDiffAdj < 0);
  document.getElementById('gold-prev').textContent = `${fmt(goldPrevAdj)} 円`;

  document.getElementById('platinum-price').textContent = `${fmt(plat)} 円`;
  const pd = document.getElementById('platinum-diff');
  pd.textContent = `(${platDiffAdj >= 0 ? '+' : ''}${fmt(platDiffAdj)} 円)`;
  pd.classList.toggle('up', platDiffAdj > 0);
  pd.classList.toggle('down', platDiffAdj < 0);
  document.getElementById('platinum-prev').textContent = `${fmt(platPrevAdj)} 円`;
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => applyKind(btn.dataset.kind, cache));
  });
  fetchData();
  setInterval(fetchData, 5 * 60 * 1000);
});
