
# scripts/predict_refresh.py
# Source: Yahoo Finance (GC=F, PL=F, JPY=X). Convert USD/oz -> JPY/g and write data/predict_latest.json
import json, datetime as dt
from zoneinfo import ZoneInfo
import yfinance as yf

OZT_TO_G = 31.1034768

def jpy_per_g(ticker_close_usd_per_oz, usd_jpy):
    return float(ticker_close_usd_per_oz) * float(usd_jpy) / OZT_TO_G

def fetch_price_and_prev(ticker, usd_jpy):
    hist = yf.Ticker(ticker).history(period="2d", interval="1d", auto_adjust=False)
    if hist.empty:
        raise RuntimeError(f"No data for {ticker}")
    last = hist.iloc[-1]["Close"]
    prev = hist.iloc[-2]["Close"] if len(hist)>=2 else last
    return jpy_per_g(last, usd_jpy), jpy_per_g(prev, usd_jpy)

def main():
    # USD/JPY
    fx = yf.Ticker("JPY=X").history(period="5d", interval="1d")
    if fx.empty:
        raise RuntimeError("No FX data")
    usd_jpy = float(fx.iloc[-1]["Close"])

    gold, gold_prev = fetch_price_and_prev("GC=F", usd_jpy)
    plat, plat_prev = fetch_price_and_prev("PL=F", usd_jpy)

    def r0(x): return int(round(x))

    payload = {
        "generated_at": dt.datetime.now(ZoneInfo("Asia/Tokyo")).isoformat(),
        "gold": {"price": r0(gold), "diff": r0(gold - gold_prev)},
        "platinum": {"price": r0(plat), "diff": r0(plat - plat_prev)}
    }
    with open("data/predict_latest.json", "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    main()
