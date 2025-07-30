document.addEventListener('DOMContentLoaded', () => {
  const sections = document.querySelectorAll('section[data-section]');
  const tabs = document.querySelectorAll('.tab-link');
  const subTabs = document.querySelectorAll('.subtab');
  const todayTbody = document.getElementById('today-tbody');
  const updatedAtEl = document.getElementById('updated-at');
  const todayStatus = document.getElementById('today-status');

  let todayData = null;
  let currentKind = 'dealer'; // デフォルトは業者向け

  // タブ切り替え
  tabs.forEach(tab => {
    tab.addEventListener('click', e => {
      e.preventDefault();
      const target = tab.getAttribute('href').replace('#', '');

      tabs.forEach(t => t.classList.remove('is-active'));
      tab.classList.add('is-active');

      sections.forEach(sec => {
        if (sec.dataset.section === target) {
          sec.style.display = 'block';
        } else {
          sec.style.display = 'none';
        }
      });

      if (target === 'today') renderTodayTable();
    });
  });

  // サブタブ切替（業者向け / 一般向け）
  subTabs.forEach(subtab => {
    subtab.addEventListener('click', () => {
      subTabs.forEach(st => st.classList.remove('active'));
      subtab.classList.add('active');
      currentKind = subtab.dataset.kind;
      renderTodayTable();
    });
  });

  // JSONデータ取得
  async function fetchTodayData() {
    try {
      const res = await fetch('./data/today_market.json');
      todayData = await res.json();
      renderTodayTable();
    } catch (err) {
      todayTbody.innerHTML = `<tr><td colspan="3">データの取得に失敗しました</td></tr>`;
    }
  }

  // テーブル描画
  function renderTodayTable() {
    if (!todayData) return;

    // 更新日
    updatedAtEl.textContent = `更新: ${new Date(todayData.generated_at).toLocaleTimeString('ja-JP', {hour: '2-digit', minute: '2-digit'})}`;
    todayStatus.textContent = `毎朝 9:45 に自動更新（色石バンクの98%を表示）`;

    const tbody = [];

    // 各カテゴリを展開
    for (const category in todayData.sections) {
      todayData.sections[category].forEach(item => {
        tbody.push(`
          <tr>
            <td>${category}</td>
            <td>${item.label}</td>
            <td style="text-align:right">${item[currentKind].toLocaleString()} 円</td>
          </tr>
        `);
      });
    }

    todayTbody.innerHTML = tbody.join('');
  }

  // 初期化
  fetchTodayData();
});
