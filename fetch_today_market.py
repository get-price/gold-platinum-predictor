# fetch_today_market.py
# 色石バンクの相場を取得して、data/today_market.json を生成
# - gold     : K24, K22, K21.6, K20, K18, K14, K12, K10, K9, K18WG, K14WG
# - platinum : PT1000, PT950, PT900, PT850
# - palladium: PD1000
# - combo    : 代表的な金×Ptのコンビ
# - silver   : SV1000, SV950, SV925
# さらに、田中貴金属の「店頭買取価格（税込）」×0.99（Au/Pt/Ag）を ingot_tanaka に追加
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
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
}

# -------------------------
# 共通ユーティリティ
# -------------------------
def to_int(text: str) -> int:
    """整数のみ（カンマ・円を除去）"""
    if text is None:
        return 0
    t = re.sub(r"[^\d]", "", str(text))
    return int(t) if t.isdigit() else 0

def to_float(text: str) -> float:
    """小数対応（カンマ・円を除去）"""
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

# -------------------------
# 色石バンク側の解析
# -------------------------
def nearest_heading_text(tbl) -> str:
    """テーブル直前の見出しテキスト（カテゴリ判定用）"""
    h = tbl.find_previous(["h1", "h2", "h3", "h4", "h5"])
    return (h.get_text(strip=True) if h else "").replace("\u3000", " ")

def detect_category(heading_text: str) -> str | None:
    ht = heading_text
    if any(k in ht for k in ["金", "ゴールド"]):
        return "gold"
    if any(k in ht for k in ["プラチナ", "白金"]):
        return "platinum"
    if any(k in ht for k in ["パラジウム"]):
        return "palladium"
    if any(k in ht for k in ["シルバー", "銀"]):
        return "silver"
    if any(k in ht for k in ["コンビ"]):
        return "combo"
    return None

def label_norm(s: str) -> str:
    t = s.upper().strip()
    t = t.replace("　", " ")
    t = re.sub(r"\s+", "", t)
    t = t.replace("Ｋ", "K").replace("Ｐ", "P").replace("Ｄ", "D")
    t = t.replace("相当", "")
    return t

def parse_table_to_items(tbl) -> list[tuple[str, int]]:
    """テーブル → (label, source) の配列"""
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
    """色石バンクから sections を作る"""
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
            if cat == "gold" and not label.startswith("K"):
                continue
            if cat == "platinum" and not label.startswith("PT"):
                continue
            if cat == "palladium" and not label.startswith("PD"):
                continue
            if cat == "silver" and not label.startswith("SV"):
                continue
            sections[cat].append(build_record(label, price, dealer_factor, general_factor))

    return sections

# -------------------------
# 田中貴金属：店頭買取価格（税込）×99%
# -------------------------
def fetch_tanaka_ingot() -> dict | None:
    """
    田中貴金属のトップページから「店頭買取価格（税込）」の
    金/プラチナ/銀の数値を拾い、0.99 を掛けた値を返す。
    失敗時は None。
    """
    try:
        r = requests.get(TANAKA_URL, headers=HEADERS, timeout=20)
        r.raise_for_status()
        s = BeautifulSoup(r.text, "lxml")

        # 「店頭買取価格（税込）」というテキストを含む要素を探す
        anchor = None
        for tag in s.find_all(string=re.compile(r"店頭買取価格.*税込")):
            anchor = tag
            break

        # 近傍から金額を広めに抽出（フォールバック込み）
        nums: list[float] = []
        def collect_numbers(scope):
            tmp = []
            for t in scope.find_all(string=re.compile(r"[\d,]+(?:\.\d+)?\s*円")):
                v = to_float(t)
                if v > 0:
                    tmp.append(v)
            return tmp

        if anchor:
            box = anchor.find_parent(["tr", "table", "div"]) or s
            nums = collect_numbers(box)

        if len(nums) < 3:  # ページ構造変更に備え、全体からも拾う
            nums = collect_numbers(s)

        if len(nums) < 3:
            return None

        # 大きい順で上位3つを金/プラチナ/銀とみなす
        nums = sorted(nums, reverse=True)
        au, pt, ag = nums[0], nums[1], nums[2]

        def adj(x: float) -> float | int:
            y = x * 0.99
            # 金/白金は整数円、銀は小数ありのことが多い（閾値を500円で分岐）
            return round(y) if x >= 500 else round(y, 2)

        return {
            "source": TANAKA_URL,
            "policy": "retail_buy_price * 0.99",
            "items": [
                {"metal": "Au", "label": "金インゴット",       "price": adj(au)},
                {"metal": "Pt", "label": "プラチナインゴット", "price": adj(pt)},
                {"metal": "Ag", "label": "銀インゴット",       "price": adj(ag)},
            ],
        }
    except Exception:
        return None

# -------------------------
# 全体の組み立て
# -------------------------
def scrape() -> dict:
    sections = scrape_iroishi()

    payload = {
        "date": datetime.now(timezone(timedelta(hours=9))).strftime("%Y-%m-%d"),
        "generated_at": jst_now_iso(),
        "source": IROISHI_URL,
        "policy": {"dealer_factor": 0.98, "general_factor": 0.97},
        "sections": sections,
        # 田中貴金属のインゴット（×99%）を添える
        "ingot_tanaka": fetch_tanaka_ingot(),
    }
    return payload

def main():
    data = scrape()
    ensure_dir("data/today_market.json")
    with open("data/today_market.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    main()
