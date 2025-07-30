
const fmt = (n) => n == null ? "--" : n.toLocaleString('ja-JP', { maximumFractionDigits: 0 });
const dowJP = ["日","月","火","水","木","金","土"];

let currentKind = "dealer"; // 'dealer' or 'retail'

function applyKind(kind) {
  currentKind = kind;
  document.querySelectorAll('.tab-button').forEach(btn => btn.classList.toggle('active', btn.dataset.kind===kind));
  render(dataCache);
}

function setDow() {
  const d = new Date();
  document.getElementById('dow').textContent = "曜日: " + dowJP[d.getDay()];
}

function setUpdated(ts) {
  const d = ts ? new Date(ts) : new Date();
  const s = d.toLocaleString('ja-JP', { hour12:false });
  document.getElementById('updatedAt').textContent = `更新: ${s}（5分ごと自動更新）`;
}

let dataCache = null;

async function load() {
  try {
    // add cache buster
    const res = await fetch('data/latest.json?ts=' + Date.now());
    if (!res.ok) throw new Error(res.statusText);
    const json = await res.json();
    dataCache = json;
    setUpdated(json.generated_at);
    render(json);
  } catch (e) {
    console.error("load error", e);
  }
}

function render(json) {
  if (!json) return;
  const k = currentKind;
  // gold
  const gp = json.gold[k].price_jpy_g;
  const gprev = json.gold[k].prev_jpy_g;
  const gdiff = gp - gprev;
  document.getElementById('gold-price').textContent = fmt(gp) + " 円/g";
  document.getElementById('gold-prev').textContent = fmt(gprev) + " 円/g";
  const gd = document.getElementById('gold-diff');
  gd.textContent = (gdiff >= 0 ? "+" : "") + fmt(gdiff);
  gd.classList.toggle('up', gdiff >= 0);
  gd.classList.toggle('down', gdiff < 0);

  // platinum
  const pp = json.platinum[k].price_jpy_g;
  const pprev = json.platinum[k].prev_jpy_g;
  const pdiff = pp - pprev;
  document.getElementById('platinum-price').textContent = fmt(pp) + " 円/g";
  document.getElementById('platinum-prev').textContent = fmt(pprev) + " 円/g";
  const pd = document.getElementById('platinum-diff');
  pd.textContent = (pdiff >= 0 ? "+" : "") + fmt(pdiff);
  pd.classList.toggle('up', pdiff >= 0);
  pd.classList.toggle('down', pdiff < 0);
}

document.addEventListener('DOMContentLoaded', () => {
  setDow();
  load();
  setInterval(load, 60 * 1000);

  document.getElementById('tab-today').addEventListener('click', e => e.preventDefault());
  document.getElementById('tab-tomorrow').addEventListener('click', e => e.preventDefault());

  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.addEventListener('click', () => applyKind(btn.dataset.kind));
  });
});
