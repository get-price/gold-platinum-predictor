
// 曜日配列
const JP_DOW = ["日","月","火","水","木","金","土"];
// 上位タブのモード: 'tomorrow' | 'today' | 'gem'
let currentTopTab = 'tomorrow';

function formatYMDWithDow(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const da = String(d.getDate()).padStart(2,'0');
  const w = JP_DOW[d.getDay()];
  return `${y}-${m}-${da}（${w}）`;
}

function setHeadingByMode(mode) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 24*60*60*1000);

  const headingText = document.getElementById('heading-text');
  const headingDate = document.getElementById('heading-date');
  const metaDate = document.getElementById('today-date');

  if (mode === 'tomorrow') {
    if (headingText) headingText.textContent = '翌日の相場予想';
    if (headingDate) headingDate.textContent = formatYMDWithDow(tomorrow); // 見出し横に翌日
    if (metaDate)   metaDate.textContent   = formatYMDWithDow(tomorrow);
  } else if (mode === 'today') {
    if (headingText) headingText.textContent = '本日の買取相場';
    if (headingDate) headingDate.textContent = formatYMDWithDow(today);
    if (metaDate)   metaDate.textContent   = formatYMDWithDow(today);
  } else {
    if (headingText) headingText.textContent = '色石相場';
    if (headingDate) headingDate.textContent = formatYMDWithDow(today);
    if (metaDate)   metaDate.textContent   = formatYMDWithDow(today);
  }
}

function setUpdatedClock() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2,'0');
  const mm = String(now.getMinutes()).padStart(2,'0');
  const el = document.getElementById('updated-at');
  if (el) el.textContent = `更新: ${hh}:${mm}`;
}

// ヘッダータブ切替
(function () {
  const links = document.querySelectorAll('.tab-link');
  function setActive(target) {
    links.forEach(a => {
      const active = a.dataset.tab === target;
      a.classList.toggle('is-active', active);
      a.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    setHeadingByMode(target);
  }
  links.forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const target = a.dataset.tab;
      currentTopTab = target;
      setActive(target);
      // 必要ならここで body の表示を切り替える（data-section 等）
    });
  });
  const initial = (location.hash || '#tomorrow').replace('#','');
  currentTopTab = initial;
  setActive(initial);
})();

setUpdatedClock();
setInterval(setUpdatedClock, 60 * 1000);

// ---------- 本日の「業者向け / 一般向け」サブタブはUIラベルから(3%減)を外す ----------
// UIテキストは「一般向け」に統一し、計算は内部で x0.97 を適用する想定
// 価格レンダリング側の既存コードにて、一般向け = Math.round(dealer * 0.97) を適用してください。
