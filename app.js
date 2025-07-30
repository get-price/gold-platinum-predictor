// ===== 追加・差し替え：共通ユーティリティ =====
const JP_DOW = ["日","月","火","水","木","金","土"];
const $ = (sel) => document.querySelector(sel);

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

// ===== 翌日の相場予想（#tomorrow） =====
async function fetchPredict() {
  const status = $('#predict-status');
  try {
    const res = await fetch('./data/predict_latest.json?ts=' + Date.now());
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();

    const g = data.gold, p = data.platinum;
    $('#heading-text').textContent = '翌日の相場予想';
    $('#heading-date').textContent = fmtTomorrow();

    // 価格
    $('#gold-price').textContent     = `${g.price.toLocaleString()} 円`;
    $('#platinum-price').textContent = `${p.price.toLocaleString()} 円`;

    // diff は（今日比）なので色付けしたい場合は class 付ける
    // ここではシンプルに status に注記
    if (status) status.textContent = '';
  } catch (e) {
    console.error('predict fetch error', e);
    if (status) status.textContent = '予測データの取得に失敗しました。リロードで再取得します。';
  }
}

// 毎分の時計更新（#tomorrow 用）
setNowClock();
setInterval(setNowClock, 60 * 1000);
fetchPredict();
setInterval(fetchPredict, 5 * 60 * 1000);

// ===== 本日の買取相場（#today） =====
let todayData = null;
let currentKind = 'dealer';

async function fetchTodayData() {
  try {
    const res = await fetch('./data/today_market.json?ts=' + Date.now());
    if (!res.ok) throw new Error('HTTP ' + res.status);
    todayData = await res.json();
    renderTodayTable();
  } catch (e) {
    console.error('today fetch error', e);
    const tbody = $('#today-tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="3" style="text-align:center">データ取得に失敗しました</td></tr>`;
  }
}

function renderTodayTable() {
  if (!todayData) return;

  // ←← 重要：#updated-at には触れない（#tomorrow 用の時計だから）
  // 今日の更新時刻は #today-status にのみ表示
  const tstat = $('#today-status');
  if (tstat && todayData.generated_at) {
    const dt = new Date(todayData.generated_at);
    const hh = String(dt.getHours()).padStart(2,'0');
    const mm = String(dt.getMinutes()).padStart(2,'0');
    tstat.textContent = `更新: ${hh}:${mm}`;
  }

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

// サブタブ（業者/一般）
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
      // #today を開いたときだけ today を描画
      if (!todayData) fetchTodayData();
      else renderTodayTable();
    } else if (target === 'tomorrow') {
      // #tomorrow に戻ったら時計を上書き
      setNowClock();
    }
  });
});

// 初期ロード
fetchTodayData(); // （裏で先読みしておいてOK）
