
# 金・プラチナ 買取相場（5分ごと更新）

- GitHub Pages で静的公開
- `data/latest.json` を **GitHub Actionsが5分ごとに更新**
- フロントは `index.html + assets/` が JSON を読み取って表示します（リロード不要／自動反映）

## セットアップ
1. この一式をリポジトリのルートに配置（既存ファイルがある場合はマージ）
2. GitHub Pages の設定を **main / root** で有効化
3. Actions タブで `Refresh prices every 5 minutes` が動いていることを確認

## 設定を変えたい場合
- 一般向け価格 = 業者向けの 5%減 → `scripts/refresh.py` 内の `0.95` を変更
- 通貨換算: `JPY=X`（USDJPY）で計算。銘柄は `GC=F`（金先物）, `PL=F`（白金先物）

## 注意
- GitHub Actions のスケジュールは実行タイミングが数分遅延することがあります。
