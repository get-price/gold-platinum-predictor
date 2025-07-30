
# 宮善貴金属 相場サイト（完成一式）

## 概要
- **翌日の相場予想**：5分ごと自動更新（ソース: Yahoo Finance 先物 + USDJPY）。
- **本日の買取相場**：毎朝 **09:45 JST** に取得（ソース: **色石バンク**）。表示は **相場の98%**。
- フロントは `index.html`（ヘッダーにタブ）、データは `data/*.json` を参照。

## データソース（固定）
- 予測用（5分ごと）
  - 金: `GC=F`（COMEX Gold futures, Yahoo Finance）
  - プラチナ: `PL=F`（NYMEX Platinum futures, Yahoo Finance）
  - 為替: `JPY=X`（USD/JPY, Yahoo Finance）
- 本日相場（09:45）
  - 色石バンク: https://iroishi-bank.jp/market/

## JSON
- `data/predict_latest.json`
```json
{ "generated_at":"...", "gold": { "price":17295,"prev":17245 }, "platinum": { "price":7287,"prev":7307 } }
```
- `data/today_market.json`（**表示98%値**）
```json
{ "date":"YYYY-MM-DD", "date_text":"2025年7月30日の", "gold":{ "K24":17010, ... }, "platinum":{...}, "combo":{...}, "silver":{...} }
```

## スケジュール
- GitHub Actions cron は **UTC**。JST 09:45 は `45 0 * * *` で設定。

## セットアップ
1. リポジトリ直下にこの一式を配置して push。
2. GitHub Pages を有効化（main/root）。
3. Settings → Actions → General で **Read and write permissions** を有効化。
