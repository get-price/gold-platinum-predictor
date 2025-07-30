
import json, re, datetime as dt, time
from zoneinfo import ZoneInfo

import requests
from bs4 import BeautifulSoup

URL = "https://iroishi-bank.jp/market/"

def parse_price(txt):
    # e.g. "17,010円" -> 17010
    t = re.sub(r"[^\d]", "", txt)
    return int(t) if t else None

def extract_table(section):
    rows = {}
    for tr in section.select("tr"):
        tds = tr.find_all(["td","th"])
        if len(tds) < 2: 
            continue
        label = tds[0].get_text(strip=True)
        price = parse_price(tds[1].get_text())
        if label and price is not None:
            rows[label] = price
    return rows

def main():
    resp = requests.get(URL, timeout=20, headers={"User-Agent":"Mozilla/5.0 (compatible; MiyazenBot/1.0)"})
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    # Attempt to locate sections by headings keywords
    text = soup.get_text(" ", strip=True)
    # Date text for titles (fallback to today)
    now = dt.datetime.now(ZoneInfo("Asia/Tokyo"))
    date_text = f"{now.year}年{now.month}月{now.day}日の"

    # Try to find tables near keywords
    gold_section = soup.find(string=re.compile("金.*買取価格")).find_parent().find_next("table")
    plat_section = soup.find(string=re.compile("プラチナ.*買取価格")).find_parent().find_next("table")
    combo_section = soup.find(string=re.compile("コンビ")).find_parent().find_next("table")
    silver_section = soup.find(string=re.compile("シルバー")).find_parent().find_next("table")

    gold = extract_table(gold_section) if gold_section else {}
    platinum = extract_table(plat_section) if plat_section else {}
    combo = extract_table(combo_section) if combo_section else {}
    silver = extract_table(silver_section) if silver_section else {}

    payload = {
        "date": now.strftime("%Y-%m-%d"),
        "date_text": date_text,
        "gold": gold,
        "platinum": platinum,
        "combo": combo,
        "silver": silver
    }

    with open("data/today_market_raw.json", "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    # For display we use 98%
    def scale(d): return {k: round(v*0.98) for k,v in d.items()}
    display = {
        "date": payload["date"],
        "date_text": payload["date_text"],
        "gold": scale(gold),
        "platinum": scale(platinum),
        "combo": scale(combo),
        "silver": scale(silver)
    }
    with open("data/today_market.json", "w", encoding="utf-8") as f:
        json.dump(display, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    main()
