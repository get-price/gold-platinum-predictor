# predict_refresh.py
import os, json
from datetime import datetime, timezone, timedelta
import yfinance as yf

OZT_TO_G = 31.1034768  # トロイオンス→グラム

def jpy_per_g_from_ticker(ticker: str, usd_jpy: float) -> tuple[int, int]:
    """(現在値, 前日終値) を 円/グラム で返す"""
    hist = yf.Ticker(ticker).history(period="2d", interval="1d", auto_adjust=False)
    if hist is None or len(hist) == 0:
        raise RuntimeError(f"No data for {ticker}")
    last = float(hist.iloc[-1]["Close"])
    prev = float(hist.iloc[-2]["Close"]) if len(hist) >= 2 else last
    now_jpy_g  = last * usd_jpy / OZT_TO_G
    prev_jpy_g = prev * usd_jpy / OZT_TO_G
    return int(round(now_jpy_g)), int(round(prev_jpy_g))

def main():
    # 為替（USD/JPY）
    fx = yf.Ticker("JPY=X").history(period="5d", interval="1d")
    if fx is None or len(fx) == 0:
        raise RuntimeError("No FX data (JPY=X)")
    usd_jpy = float(fx.iloc[-1]["Close"])

    # 金・プラチナ（固定ソース）
    gold_now, gold_prev = jpy_per_g_from_ticker("GC=F", usd_jpy)
    plat_now, plat_prev = jpy_per_g_from_ticker("PL=F", usd_jpy)

    jst = timezone(timedelta(hours=9))
    payload = {
        "generated_at": datetime.now(jst).isoformat(),
        "note": "source: Yahoo Finance (GC=F, PL=F, JPY=X) → JPY/gram",
        "gold":     {"price": gold_now, "diff": gold_now - gold_prev},
        "platinum": {"price": plat_now, "diff": plat_now - plat_prev},
    }

    os.makedirs("data", exist_ok=True)
    with open("data/predict_latest.json", "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    main()
