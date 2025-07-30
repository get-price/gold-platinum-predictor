
import json, datetime as dt
from zoneinfo import ZoneInfo
import math
import yfinance as yf

OZT_TO_G = 31.1034768

def jpy_per_g(ticker, usd_jpy):
    hist = yf.Ticker(ticker).history(period="2d", interval="1d", auto_adjust=False)
    if len(hist) == 0:
        raise RuntimeError(f"No data for {ticker}")
    last = hist.iloc[-1]["Close"]
    prev = hist.iloc[-2]["Close"] if len(hist) >= 2 else last
    price = float(last) * usd_jpy / OZT_TO_G
    prevp = float(prev) * usd_jpy / OZT_TO_G
    return round(price), round(prevp)

def main():
    fx = yf.Ticker("JPY=X").history(period="5d", interval="1d")
    if len(fx)==0:
        raise RuntimeError("No FX data")
    usd_jpy = float(fx.iloc[-1]["Close"])

    gold, gold_prev = jpy_per_g("GC=F", usd_jpy)
    plat, plat_prev = jpy_per_g("PL=F", usd_jpy)

    payload = {
        "generated_at": dt.datetime.now(ZoneInfo("Asia/Tokyo")).isoformat(),
        "gold": {"price": gold, "prev": gold_prev},
        "platinum": {"price": plat, "prev": plat_prev}
    }
    with open("data/predict_latest.json", "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    main()
