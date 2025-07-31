// ===== 共通 =====
const JP_DOW = ["日","月","火","水","木","金","土"];
const $ = (s) => document.querySelector(s);

function fmtTomorrow() {
  const now = new Date();
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}（${JP_DOW[t.getDay()]}）`;
}
function setNowClock() {
  const el = $('#updated-at');
  const now = new Date();
  if (el) el.textContent = `更新: ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
}

// ===== 翌日の相場予想 =====
async function fetchPredict() {
  const status = $('#predict-status');
  try {
    const res = await fetch('./predict_latest.json?ts=' + Date.now());
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();

    const g = data.gold, p = data.platinum;
    $('#heading-text').textContent = '翌日の相場予想';
    $('#heading-date').textContent = fmtTomorrow();

    $('#gold-price').textContent     = `${Number(g.price).toLocaleString()} 円`;
    $('#platinum-price').textContent = `${Number(p.price).toLocaleString()} 円`;

    const setDiff = (el, v) => {
      if (!el) return;
      const n = Number(v || 0);
      el.className = 'diff ' + (n > 0 ? 'up' : n < 0 ? 'down' : '');
      el.textContent = `(${n > 0 ? '+' : ''}${n.toLocaleString()} 円)`;
    };
    setDiff($('#gold-diff'), g.diff);
    setDiff($('#platinum-diff'), p.diff);

    if (status) status.textContent = '';
  } catch (e) {
    console.error('predict fetch error', e);
    if (status) status.textContent = '予測データの取得に失敗しました。';
  }
}
setNowClock();
setInterval(setNowClock, 60 * 1000);
fetchPredict();
setInterval(fetchPredict, 5 * 60 * 1000);

// ===== 本日の買取相場 =====
let todayData = null;
let currentKind = 'dealer';

// 旧形式 -> 新形式へ正規化（フロントで対応）
function normalizeTodayData(data) {
  if (data && data.sections) return data;

  const mapCat = (c) => {
    const t = (c || '').toString().trim();
    if (['金','ゴールド'].includes(t))  return 'gold';
    if (['プラチナ','白金'].includes(t)) return 'platinum';
    if (['シルバー','銀'].includes(t))   return 'silver';
    if (['コンビ'].includes(t))           return 'combo';
    if (['パラジウム'].includes(t))       return 'palladium';
    return 'others';
  };

  const sections = { gold:[], platinum:[], palladium:[], combo:[], silver:[] };
  (data?.items || []).forEach(it => {
    const cat = mapCat(it.category);
    if (!sections[cat]) return;
    const label   = String(it.fineness || '').toUpperCase();
    const source  = Number(it.price_jpy_g || 0);
    const dealer  = Math.round(source * 0.98);
    const general = Math.round(dealer * 0.97);
    sections[cat].push({ label, source, dealer, general });
  });

  return {
    date: data?.date || '',
    generated_at: data?.generated_at || '',
    source: data?.source || 'legacy_items_json',
    policy: { dealer_factor: 0.98, general_factor: 0.97 },
    sections,
    ingot_tanaka: data?.ingot_tanaka ?? null
  };
}

// ingot_tanaka を描画（items型 / キー型 に対応）
function renderIngotCards(ing) {
  const row = $('#ingot-row');
  if (!row) return;

  const set = { Au:null, Pt:null, Ag:null };

  if (ing && Array.isArray(ing.items)) {
    for (const it of ing.items) {
      const m = (it.metal || '').toString();
      if (['Au','Pt','Ag'].includes(m)) set[m] = it.price;
    }
  } else if (ing && typeof ing === 'object') {
    // gold/platinum/silver or Au/Pt/Ag
    set.Au = ing.Au ?? ing.gold;
    set.Pt = ing.Pt ?? ing.platinum;
    set.Ag = ing.Ag ?? ing.silver;
  }

  const hasAny = [set.Au,set.Pt,set.Ag].some(v => v!=null && v!=='');
  if (!hasAny) {
    row.style.display = 'none';
    return;
  }

  const fmt = (v) => {
    const n = Number(v);
    if (Number.isNaN(n)) return String(v);
    return (n % 1 === 0)
      ? n.toLocaleString()
      : n.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
  };

  $('#ingot-au').textContent = (set.Au!=null && set.Au!=='') ? `${fmt(set.Au)} 円` : '--';
  $('#ingot-pt').textContent = (set.Pt!=null && set.Pt!=='') ? `${fmt(set.Pt)} 円` : '--';
  $('#ingot-ag').textContent = (set.Ag!=null && set.Ag!=='') ? `${fmt(set.Ag)} 円` : '--';
  row.style.display = 'grid';
}

async function fetchTodayData() {
  try {
    const res = await fetch('./today_market.json?ts=' + Date.now());
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const raw = await res.json();
    todayData = normalizeTodayData(raw);
    renderTodayTable();
  } catch (e) {
    console.error('today fetch error', e);
    const tbody = $('#today-tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="3" style="text-align:center">データ取得に失敗しました</td></tr>`;
  }
}

function renderTodayTable() {
  if (!todayData) return;

  // 更新時刻
  const tstat = $('#today-status');
  if (tstat && todayData.generated_at) {
    const dt = new Date(todayData.generated_at);
    const hh = String(dt.getHours()).padStart(2,'0');
    const mm = String(dt.getMinutes()).padStart(2,'0');
    tstat.textContent = `更新: ${hh}:${mm}`;
  }

  // 田中インゴット（×99%）— あれば表示、無ければ非表示
  renderIngotCards(todayData.ingot_tanaka);

  // テーブル描画
  const tbody = $('#today-tbody');
  if (!tbody) return;
  const rows = [];
  for (const category in todayData.sections) {
    todayData.sections[category].forEach(item => {
      const price = item[currentKind] ?? item.dealer ?? 0;
      rows.push(`
        <tr>
          <td>${category}</td>
          <td>${item.label}</td>
          <td style="text-align:right">${Number(price).toLocaleString()} 円</td>
        </tr>
      `);
    });
  }
  tbody.innerHTML = rows.join('');
}

// サブタブ
document.querySelectorAll('.subtab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.subtab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentKind = btn.dataset.kind || 'dealer';
    renderTodayTable();
  });
});

// タブ切替
document.querySelectorAll('.tab-link').forEach(a => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    const target = a.getAttribute('href').replace('#', '');
    document.querySelectorAll('.tab-link').forEach(t => t.classList.remove('is-active'));
    a.classList.add('is-active');

    document.querySelectorAll('section[data-section]').forEach(sec => {
      sec.style.display = (sec.dataset.section === target) ? 'block' : 'none';
    });

    if (target === 'today') {
      if (!todayData) fetchTodayData(); else renderTodayTable();
    } else if (target === 'tomorrow') {
      setNowClock();
    }
  });
});

// 初期ロード
fetchTodayData();
