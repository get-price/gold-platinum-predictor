import os
import re
import json
from datetime import datetime, timezone, timedelta
import requests
from bs4 import BeautifulSoup

IROISHI_URL = "https://iroishi-bank.jp/market/"
TANAKA_URL = "https://gold.tanaka.co.jp/index.php"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    )
}

def to_int(text: str) -> int:
    t = re.sub(r"[^\d]", "", str(text))
    return int(t) if t.isdigit() else 0

def to_float(text: str) -> float:
    t = re.sub(r"[^\d.]", "", str(text))
    try:
        return float(t)
    except:
        return 0.0

def jst_now_iso() -> str:
    return datetime.now(timezone(timedelta(hours=9))).isoformat()

def ensure_dir(path: str):
    os.makedirs(os.path.dirname(path), exist_ok=True)

def label_norm(s: str) -> str:
    return re.sub(r"\s+", "", s.upper().replace("　", "").replace("Ｋ", "K").replace("Ｐ", "P").replace("Ｄ", "D"))

def parse_table_to_items(tbl) -> list[tuple[str, int]]:
    items = []
    for tr in tbl.find_all("tr"):
        tds = tr.find_all(["td", "th"])
        if len(tds) < 2:
            continue
        label = label_norm(tds[0].get_text())
        price = to_int(tds[1].get_text())
        if label and price > 0:
            items.append((label, price))
    return items

def nearest_heading_text(tbl) -> str:
    h = tbl.find_previous(["h1", "h2", "h3", "h4", "h5"])
    return (h.get_text(strip=True) if h else "").replace("\u3000", " ")

def detect_category(heading_text: str) -> str | None:
    ht = heading_text
    if any(k in ht for k in ["金", "ゴールド"]): return "gold"
    if any(k in ht for k in ["プラチナ", "白金"]): return "platinum"
    if any(k in ht for k in ["パラジウム"]): return "palladium"
    if any(k in ht for k in ["シルバー", "銀"]): return "silver"
    if any(k in ht for k in ["コンビ"]): return "combo"
    return None

def build_record(label: str, source: int, d_factor: float, g_factor: float) -> dict:
    dealer = round(source * d_factor)
    general = round(dealer * g_factor)
    return {"label": label, "source": source, "dealer": dealer, "general": general}

def scrape_iroishi() -> dict:
    r = requests.get(IROISHI_URL, headers=HEADERS, timeout=20)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "lxml")

    sections = {k: [] for k in ["gold", "platinum", "palladium", "combo", "silver"]}
    dealer_factor = 0.98
    general_factor = 0.97

    for tbl in soup.find_all("table"):
        cat = detect_category(nearest_heading_text(tbl))
        if not cat:
            continue
        for label, price in parse_table_to_items(tbl):
            if cat == "gold" and not label.startswith("K"): continue
            if cat == "platinum" and not label.startswith("PT"): continue
            if cat == "palladium" and not label.startswith("PD"): continue
            if cat == "silver" and not label.startswith("SV"): continue
            sections[cat].append(build_record(label, price, dealer_factor, general_factor))

    return sections

def fetch_tanaka_ingot() -> dict | None:
    try:
        r = requests.get(TANAKA_URL, headers=HEADERS, timeout=20)
        r.raise_for_status()
        s = BeautifulSoup(r.text, "lxml")

        labels = {
            "Au": "金買取価格（税込）",
            "Pt": "プラチナ買取価格（税込）",
            "Ag": "銀買取価格（税込）"
        }

        vals = {}
        for metal, label in labels.items():
            tag = s.find(string=re.compile(label))
            if not tag:
                continue
            box = tag.find_parent(["div", "td", "tr", "section"]) or s
            price_text = box.find(string=re.compile(r"[\d,]+円"))
            if price_text:
                raw = to_int(str(price_text))
                if raw > 0:
                    vals[metal] = raw

        if not vals:
            return None

        items = []
        for metal, source in vals.items():
            dealer = round(source * 0.98)
            general = round(dealer * 0.97)
            label = "金インゴット" if metal == "Au" else "プラチナインゴット" if metal == "Pt" else "銀インゴット"
            items.append({
                "metal": metal,
                "label": label,
                "source": source,
                "dealer": dealer,
                "general": general
            })

        return {
            "source": TANAKA_URL,
            "policy": "retail_buy_price * 0.98 * 0.97",
            "items": items
        }
    except Exception as e:
        print(f"[ERROR] fetch_tanaka_ingot(): {e}")
        return None

def scrape() -> dict:
    sections = scrape_iroishi()
    payload = {
        "date": datetime.now(timezone(timedelta(hours=9))).strftime("%Y-%m-%d"),
        "generated_at": jst_now_iso(),
        "source": IROISHI_URL,
        "policy": {"dealer_factor": 0.98, "general_factor": 0.97},
        "sections": sections,
        "ingot_tanaka": fetch_tanaka_ingot()
    }
    return payload

def main():
    data = scrape()
    ensure_dir("data/today_market.json")
    with open("data/today_market.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    main()
