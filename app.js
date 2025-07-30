// assets/app.js  ← この内容で上書きしてください

// ==== 共通 ====
const JP_DOW = ["日","月","火","水","木","金","土"];
const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const fmtDate = d => {
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), da=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${da}（${JP_DOW[d.getDay()]}）`;
};
function setUpdatedClock(){
  const now=new Date();
  const hh=String(now.getHours()).padStart(2,'0');
  const mm=String(now.getMinutes()).padStart(2,'0');
  const el=$("#updated-at");
  if(el) el.textContent = `更新: ${hh}:${mm}`;
}
async function safeFetchJSON(url){
  try{
    const res = await fetch(url + '?ts=' + Date.now());
    if(!res.ok) throw new Error(res.status + ' ' + res.statusText);
    return await res.json();
  }catch(e){
    console.error('fetch fail', url, e);
    return null;
  }
}

// ==== 見出し（日付の自動表示） ====
function setHeading(mode){ // 'tomorrow' | 'today' | 'stones'
  const h1  = $("#heading-text");
  const h1d = $("#heading-date");
  const meta= $("#meta-date");

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 24*60*60*1000);

  if(mode === 'today'){
    h1 && (h1.textContent = "本日の買取相場");
    h1d && (h1d.textContent = fmtDate(today));
    meta && (meta.textContent = fmtDate(today));
  }else{
    // default: tomorrow
    h1 && (h1.textContent = "翌日の相場予想");
    h1d && (h1d.textContent = fmtDate(tomorrow));
    meta && (meta.textContent = fmtDate(tomorrow));
  }
}

// ==== 翌日の相場予想（5分ごと） ====
async function loadPredict(){
  const st = $("#predict-status");
  const data = await safeFetchJSON("./data/predict_latest.json");
  if(!data){ st && (st.textContent="データ取得できません"); return; }

  const g = data.gold, p = data.platinum;
  const gDiffCls = g.diff>0?'up':(g.diff<0?'down':'');
  const pDiffCls = p.diff>0?'up':(p.diff<0?'down':'');

  const goldPrice = $("#gold-price");
  const goldDiff  = $("#gold-diff");
  const platPrice = $("#platinum-price");
  const platDiff  = $("#platinum-diff");

  if(goldPrice) goldPrice.textContent = `${g.price.toLocaleString()} 円`;
  if(goldDiff){ goldDiff.textContent = `(${g.diff>=0?'+':''}${g.diff.toLocaleString()}円)`; goldDiff.className = `diff ${gDiffCls}`; }
  if(platPrice) platPrice.textContent = `${p.price.toLocaleString()} 円`;
  if(platDiff){ platDiff.textContent = `(${p.diff>=0?'+':''}${p.diff.toLocaleString()}円)`; platDiff.className = `diff ${pDiffCls}`; }

  st && (st.textContent = "5分ごとに自動更新");
}

// ==== 本日の買取相場（毎朝9:45に更新されたJSONを表示） ====
// today_market.json の構造：{ sections: { gold:[{label, dealer, general}], platinum:[], combo:[], silver:[] } }
const CATEGORY_LABEL = { gold:"金", platinum:"プラチナ", combo:"コンビ", silver:"シルバー" };
const ORDER = ["gold","platinum","combo","silver"];

async function loadToday(activeKind){ // 'dealer' | 'retail'（= general）
  const data = await safeFetchJSON("./data/today_market.json");
  const tbody = $("#today-tbody");
  const st = $("#today-status");
  if(!tbody){ return; }
  if(!data){ st && (st.textContent="データ取得できません"); tbody.innerHTML=""; return; }

  const view = (activeKind === "retail") ? "general" : "dealer";
  const sections = data.sections || {};
  let rows = "";

  for(const key of ORDER){
    const items = sections[key] || [];
    for(const it of items){
      const price = (it[view] ?? it.dealer ?? it.general ?? it.source) || 0;
      rows += `<tr>
        <td>${CATEGORY_LABEL[key] || ""}</td>
        <td>${it.label || ""}</td>
        <td style="text-align:right">${Number(price).toLocaleString()} 円</td>
      </tr>`;
    }
  }
  tbody.innerHTML = rows || `<tr><td colspan="3" style="text-align:center">データがありません</td></tr>`;
  st && (st.textContent = "毎朝 9:45 に自動更新（色石バンクの98%を表示）");
}

// ==== タブ/サブタブの制御 ====
function showSection(mode){ // 'tomorrow' | 'today' | 'stones'
  $$('[data-section]').forEach(sec => sec.style.display = (sec.getAttribute('data-section') === mode) ? "" : "none");
  $$('.tab-link').forEach(a => {
    const active = (a.getAttribute('href') === `#${mode}`);
    a.classList.toggle('is-active', active);
    a.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  setHeading(mode);
  if(mode === 'today'){
    const activeBtn = $('.subtab.active');
    const kind = activeBtn ? activeBtn.dataset.kind : 'dealer';
    loadToday(kind);
  }
}

// ==== 初期化 ====
document.addEventListener('DOMContentLoaded', () => {
  // 初期タブ（URLハッシュも考慮）
  const hash = location.hash.replace('#','');
  const initial = (hash === 'today' || hash === 'stones') ? hash : 'tomorrow';
  showSection(initial);

  // 時計
  setUpdatedClock();
  setInterval(setUpdatedClock, 60*1000);

  // データ読み込み
  loadPredict();
  setInterval(loadPredict, 5*60*1000); // 5分ごと
  if(initial === 'today'){ loadToday('dealer'); }

  // 上位タブ
  $$('.tab-link').forEach(a => {
    a.addEventListener('click', e => {
      const mode = a.getAttribute('href').replace('#','');
      showSection(mode);
    });
  });

  // 本日のサブタブ（業者/一般）
  $$('.subtab').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.subtab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadToday(btn.dataset.kind); // 'dealer' or 'retail'
    });
  });
});
