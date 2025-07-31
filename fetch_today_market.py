# fetch_today_market.py
# 色石バンクの相場を取得して、data/today_market.json を生成
# - gold / platinum / palladium / combo / silver
# さらに田中貴金属の「店頭買取価格（税込）」×0.99（Au/Pt/Ag）を ingot_tanaka に追加
#
# dealer = round(source * 0.98)
# general = round(dealer * 0.97)

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

# ========== 共通ユーティリティ ==========
def to_int(text: str) -> int:
    if text is None:
        return 0
    t = re.sub(r"[^\d]", "", str(text))
    return int(t) if t.isdigit() else 0

def to_float(text: str) -> float:
    if text is None:
        return 0.0
    t = re.sub(r"[^\d\.]", "", str(text))
    try:
        return float(t)
    except Exception:
        return 0.0

def jst_now_iso() -> str:
    jst = timezone(timedelta(hours=9))
    return datetime.now(jst).isoformat()

def ensure_dir(path: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)

# ========== 色石バンク：解析 ==========
def nearest_heading_text(tbl) -> str:
    h = tbl.find_previous(["h1", "h2", "h3", "h4", "h5"])
    return (h.get_text(strip=True) if h else "").replace("\u3000", " ")

def detect_category(heading_text: str) -> str | None:
    ht = heading_text
    if any(k in ht for k in ["金", "ゴールド"]):       return "gold"
    if any(k in ht for k in ["プラチナ", "白金"]):      return "platinum"
    if any(k in ht for k in ["パラジウム"]):           return "palladium"
    if any(k in ht for k in ["シルバー", "銀"]):       return "silver"
    if any(k in ht for k in ["コンビ"]):               return "combo"
    return None

def label_norm(s: str) -> str:
    t = s.upper().strip()
    t = t.replace("　", " ")
    t = re.sub(r"\s+", "", t)
    t = t.replace("Ｋ", "K").replace("Ｐ", "P").replace("Ｄ", "D")
    t = t.replace("相当", "")
    return t

def parse_table_to_items(tbl) -> list[tuple[str, int]]:
    items = []
    trs = tbl.find_all("tr")
    for tr in trs:
        tds = tr.find_all(["td", "th"])
        if len(tds) < 2:
            continue
        label = label_norm(tds[0].get_text())
        price = to_int(tds[1].get_text())
        if label and price > 0:
            items.append((label, price))
    return items

def build_record(label: str, source: int, d_factor: float, g_factor: float) -> dict:
    dealer = round(source * d_factor)
    general = round(dealer * g_factor)
    return {"label": label, "source": source, "dealer": dealer, "general": general}

def scrape_iroishi() -> dict:
    r = requests.get(IROISHI_URL, headers=HEADERS, timeout=20)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "lxml")

    sections: dict[str, list[dict]] = {
        "gold": [], "platinum": [], "palladium": [], "combo": [], "silver": []
    }

    dealer_factor = 0.98
    general_factor = 0.97

    for tbl in soup.find_all("table"):
        cat = detect_category(nearest_heading_text(tbl))
        if not cat:
            continue
        for label, price in parse_table_to_items(tbl):
            if cat == "gold"      and not label.startswith("K"):  continue
            if cat == "platinum"  and not label.startswith("PT"): continue
            if cat == "palladium" and not label.startswith("PD"): continue
            if cat == "silver"    and not label.startswith("SV"): continue
            sections[cat].append(build_record(label, price, dealer_factor, general_factor))

    return sections

# ========== 田中貴金属：店頭買取価格（税込）×99% ==========
def _collect_prices_nearby(scope) -> list[float]:
    vals = []
    for t in scope.find_all(string=re.compile(r"[\d,]+(?:\.\d+)?\s*円")):
        v = to_float(t)
        if v > 0:
            vals.append(v)
    return vals

def _find_labeled_prices(scope) -> dict:
    labels = {
        "Au": re.compile(r"(金|ゴールド)"),
        "Pt": re.compile(r"(プラチナ|白金)"),
        "Ag": re.compile(r"(銀|シルバー)"),
    }
    out: dict[str, float] = {}
    for metal, rx in labels.items():
        cand = None
        for tag in scope.find_all(string=rx):
            cand = tag
            break
        if not cand:
            continue
        row = cand.find_parent(["tr", "li", "p", "div"]) or scope
        prices = _collect_prices_nearby(row) or _collect_prices_nearby(scope)
        if prices:
            out[metal] = prices[0]
    return out

def fetch_tanaka_ingot() -> dict | None:
    try:
        r = requests.get(TANAKA_URL, headers=HEADERS, timeout=20)
        r.raise_for_status()
        s = BeautifulSoup(r.text, "lxml")

        anchor = None
        for tag in s.find_all(string=re.compile(r"店頭買取価格.*税込")):
            anchor = tag
            break

        vals: dict[str, float] = {}
        if anchor:
            box = anchor.find_parent(["table", "div", "section", "tr"]) or s
            vals = _find_labeled_prices(box)

        if len(vals) < 3:  # 足りない時は全体からも抽出して補完
            near = _collect_prices_nearby(s)
            if near:
                near = sorted(near, reverse=True)
                rank = {"Au": None, "Pt": None, "Ag": None}
                for i, m in enumerate(["Au", "Pt", "Ag"]):
                    if m not in vals and i < len(near):
                        rank[m] = near[i]
                for k, v in rank.items():
                    if k not in vals and v:
                        vals[k] = v

        if not all(k in vals for k in ["Au", "Pt", "Ag"]):
            return None

        def adj(x: float) -> float | int:
            y = x * 0.99
            return round(y) if x >= 500 else round(y, 2)

        items = [
            {"metal": "Au", "label": "金インゴット",       "price": adj(vals["Au"])},
            {"metal": "Pt", "label": "プラチナインゴット", "price": adj(vals["Pt"])},
            {"metal": "Ag", "label": "銀インゴット",       "price": adj(vals["Ag"])},
        ]
        return {"source": TANAKA_URL, "policy": "retail_buy_price * 0.99", "items": items}
    except Exception:
        return None

# ========== 全体の組み立て ==========
def scrape() -> dict:
    sections = scrape_iroishi()
    payload = {
        "date": datetime.now(timezone(timedelta(hours=9))).strftime("%Y-%m-%d"),
        "generated_at": jst_now_iso(),
        "source": IROISHI_URL,
        "policy": {"dealer_factor": 0.98, "general_factor": 0.97},
        "sections": sections,
        "ingot_tanaka": fetch_tanaka_ingot(),  # ← 追加
    }
    return payload

def main():
    data = scrape()
    ensure_dir("data/today_market.json")
    with open("data/today_market.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    main()
