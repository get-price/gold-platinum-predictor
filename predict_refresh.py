# predict_refresh.py  — 国内実績アンカー方式 + フォールバック
#
# 仕組み：
#  1) data/today_market.json の「dealer」を国内実績アンカー（K24/PT1000）として読む
#  2) 海外（GC=F, PL=F）の “当日/前日” 終値比（騰落率）を計算
#  3) 翌日の予想 = 国内実績 × 騰落率
#  4) today_market.json が無い/ラベル不一致のときは従来法（USD→JPY/gram）にフォールバック

import os, json
from datetime import datetime, timezone, timedelta
import yfinance as yf

OZT_TO_G = 31.1034768  # トロイオンス→グラム換算（フォールバック時に使用）

# -------- utility --------
def jpy_per_g_from_ticker(ticker: str, usd_jpy: float) -> tuple[int, int]:
    """従来ロジック：先物USD終値×USDJPY / 31.1034768。(現/前) を円/グラムで返す"""
    hist = yf.Ticker(ticker).history(period="2d", interval="1d", auto_adjust=False)
    if hist is None or len(hist) == 0:
        raise RuntimeError(f"No data for {ticker}")
    last = float(hist.iloc[-1]["Close"])
    prev = float(hist.iloc[-2]["Close"]) if len(hist) >= 2 else last
    now_jpy_g  = last * usd_jpy / OZT_TO_G
    prev_jpy_g = prev * usd_jpy / OZT_TO_G
    return int(round(now_jpy_g)), int(round(prev_jpy_g))

def last_prev_close_ratio(ticker: str) -> float:
    """終値比（当日/前日）。データ不足時は 1.0 を返す"""
    hist = yf.Ticker(ticker).history(period="2d", interval="1d", auto_adjust=False)
    if hist is None or len(hist) < 2:
        return 1.0
    last = float(hist.iloc[-1]["Close"])
    prev = float(hist.iloc[-2]["Close"])
    return (last / prev) if prev else 1.0

def load_domestic_baseline() -> tuple[int|None, int|None]:
    """
    data/today_market.json から国内実績（dealer）を取得。
    gold:  K24 の dealer
    platinum: PT1000 の dealer
    取れなければ None を返す（→ フォールバック）
    """
    path = "data/today_market.json"
    if not os.path.exists(path):
        return None, None

    try:
        with open(path, "r", encoding="utf-8") as f:
            j = json.load(f)
    except Exception:
        return None, None

    gold_base, plat_base = None, None
    secs = (j or {}).get("sections", {})

    # gold（K24）
    for it in secs.get("gold", []):
        label = str(it.get("label", "")).upper()
        if label.startswith("K24"):
            gold_base = int(it.get("dealer") or it.get("source") or 0)
            break

    # platinum（PT1000）
    for it in secs.get("platinum", []):
        label = str(it.get("label", "")).upper()
        if label.startswith("PT1000"):
            plat_base = int(it.get("dealer") or it.get("source") or 0)
            break

    if not gold_base:
        gold_base = None
    if not plat_base:
        plat_base = None
    return gold_base, plat_base

# -------- main --------
def main():
    # 為替（フォールバック用）
    fx = yf.Ticker("JPY=X").history(period="5d", interval="1d")
    if fx is None or len(fx) == 0:
        raise RuntimeError("No FX data (JPY=X)")
    usd_jpy = float(fx.iloc[-1]["Close"])

    # 国内アンカー（today_market.json）
    gold_base, plat_base = load_domestic_baseline()

    # 海外終値の騰落率
    r_gold = last_prev_close_ratio("GC=F")
    r_plat = last_prev_close_ratio("PL=F")

    if gold_base and plat_base:
        # アンカー方式：水準は国内、動きだけ海外を反映
        gold_now = int(round(gold_base * r_gold))
        plat_now = int(round(plat_base * r_plat))
        gold_prev = int(round(gold_base))
        plat_prev = int(round(plat_base))
        method_note = "anchor=today_market(dealer)×overseas_ratio"
    else:
        # フォールバック（従来法）
        gold_now, gold_prev = jpy_per_g_from_ticker("GC=F", usd_jpy)
        plat_now, plat_prev = jpy_per_g_from_ticker("PL=F", usd_jpy)
        method_note = "fallback=GC/PL(USD)×JPY→JPY/gram"

    jst = timezone(timedelta(hours=9))
    payload = {
        "generated_at": datetime.now(jst).isoformat(),
        "note": f"{method_note}",
        "gold":     {"price": gold_now, "diff": gold_now - gold_prev},
        "platinum": {"price": plat_now, "diff": plat_now - plat_prev},
    }

    os.makedirs("data", exist_ok=True)
    with open("data/predict_latest.json", "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    main()
