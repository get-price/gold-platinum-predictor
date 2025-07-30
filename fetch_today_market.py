
# scripts/fetch_today_market.py
# Source: https://iroishi-bank.jp/market/
# Scrape daily metal prices, write data/today_market.json (scaled to 98% on display layer in app.js or compute here if desired)
import json, re, datetime as dt, time
from zoneinfo import ZoneInfo
import requests
from bs4 import BeautifulSoup

URL = "https://iroishi-bank.jp/market/"

def parse_price(text):
    # extract integer like 12,345 -> 12345
    m = re.findall(r"\d[\d,]*", text)
    if not m: return None
    return int(m[0].replace(",", ""))

def fetch():
    html = requests.get(URL, timeout=20).text
    soup = BeautifulSoup(html, "lxml")

    items = []
    # This is heuristic; adjust selectors if site structure changes
    # Example: find tables with metal sections
    tables = soup.find_all("table")
    for tbl in tables:
        # Try rows
        for tr in tbl.find_all("tr"):
            tds = tr.find_all(["td","th"])
            if len(tds) < 2: continue
            row_text = " ".join(td.get_text(strip=True) for td in tds)
            # Try detect by fineness marks
            fineness = None
            for key in ["K24","K22","K20","K18","Pt1000","Pt950","Pt900","Sv925","K18/Pt900"]:
                if key in row_text:
                    fineness = key; break
            if not fineness: continue
            price = parse_price(row_text)
            if price is None: continue
            # Guess category
            category = "金" if fineness.startswith("K") else ("プラチナ" if fineness.startswith("Pt") else ("シルバー" if fineness.startswith("Sv") else "コンビ"))
            items.append({"category": category, "fineness": fineness, "price_jpy_g": price})
    now = dt.datetime.now(ZoneInfo("Asia/Tokyo"))
    return {"date": now.strftime("%Y-%m-%d"), "items": items}

def main():
    data = fetch()
    with open("data/today_market.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    main()
