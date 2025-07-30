
import json, math, datetime as dt, time
from zoneinfo import ZoneInfo

import yfinance as yf

OZT_TO_G = 31.1034768

def jpy_per_g_from_ticker(ticker, jpy_rate):
    data = yf.Ticker(ticker).history(period="2d", interval="1d", auto_adjust=False)
    if len(data) == 0:
        raise RuntimeError(f"No data for {ticker}")
    # use last row for price, previous for prev_close
    last = data.iloc[-1]
    if len(data) >= 2:
        prev = data.iloc[-2]
        prev_close = float(prev["Close"]) * jpy_rate / OZT_TO_G
    else:
        prev_close = float(last["Close"]) * jpy_rate / OZT_TO_G

    price = float(last["Close"]) * jpy_rate / OZT_TO_G
    return price, prev_close

def main():
    # FX USDJPY
    fx = yf.Ticker("JPY=X").history(period="5d", interval="1d")
    if len(fx)==0:
        raise RuntimeError("No FX data")
    usd_jpy = float(fx.iloc[-1]["Close"])
    # Gold & Platinum futures
    gold, gold_prev = jpy_per_g_from_ticker("GC=F", usd_jpy)
    plat, plat_prev = jpy_per_g_from_ticker("PL=F", usd_jpy)

    # Round to 1 yen
    def round0(x): 
        return int(round(x))

    payload = {
        "generated_at": dt.datetime.now(ZoneInfo("Asia/Tokyo")).isoformat(),
        "note": "dealer=業者向け, retail=一般向け(5%減)。価格は円/グラム。為替と先物終値から換算。",
        "gold": {
            "dealer": {"price_jpy_g": round0(gold), "prev_jpy_g": round0(gold_prev)},
            "retail": {"price_jpy_g": round0(gold * 0.95), "prev_jpy_g": round0(gold_prev * 0.95)},
        },
        "platinum": {
            "dealer": {"price_jpy_g": round0(plat), "prev_jpy_g": round0(plat_prev)},
            "retail": {"price_jpy_g": round0(plat * 0.95), "prev_jpy_g": round0(plat_prev * 0.95)},
        },
    }

    with open("data/latest.json", "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    main()
