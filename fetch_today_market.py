# fetch_today_market.py
# 色石バンクの相場を取得して、data/today_market.json を生成
# - gold     : K24, K22, K21.6, K20, K18, K14, K12, K10, K9, K18WG, K14WG
# - platinum : PT1000, PT950, PT900, PT850
# - palladium: PD1000  ← 追加（本パッチ）
# - combo    : 代表的な金×Ptのコンビ
# - silver   : SV1000, SV950, SV925
#
# dealer = round(source * 0.98)
# general = round(dealer * 0.97)

import os
import re
import json
from datetime import datetime, timezone, timedelta

import requests
from bs4 import BeautifulSoup

URL = "https://iroishi-bank.jp/market/"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
}

# 丸め・数値化
def to_int(text: str) -> int:
    if text is None:
        return 0
    # 例: "17,356円", " 6,109 円 / g ", "176円"
    t = re.sub(r"[^\d]", "", str(text))
    return int(t) if t.isdigit() else 0

def jst_now_iso() -> str:
    jst = timezone(timedelta(hours=9))
    return datetime.now(jst).isoformat()

def ensure_dir(path: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)

# 直前の見出し（h1/h2/h3等）テキストを取得して、そのテーブルのカテゴリ判定に使う
def nearest_heading_text(tbl) -> str:
    # 直近の見出し要素を上方向に遡って探す
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
    # 表の表記ゆれを正規化
    t = s.upper().strip()
    t = t.replace("　", " ")
    t = re.sub(r"\s+", "", t)
    # よくあるバリエーションを吸収
    t = t.replace("PT", "PT").replace("Ｋ", "K").replace("Ｐ", "P").replace("Ｄ", "D")
    # 一部の冗長語を除去
    t = t.replace("相当", "")
    return t

def parse_table_to_items(tbl) -> list[tuple[str, int]]:
    """テーブル → (label, source) の配列を返す"""
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

def scrape() -> dict:
    r = requests.get(URL, headers=HEADERS, timeout=20)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "lxml")

    # 収集用
    sections: dict[str, list[dict]] = {
        "gold": [], "platinum": [], "palladium": [], "combo": [], "silver": []
    }

    # パラメータ（必要に応じてtoday.ymlからでもOK）
    dealer_factor = 0.98
    general_factor = 0.97

    # ページ内のすべてのテーブルを走査 → 直前の見出しでカテゴリ判定
    for tbl in soup.find_all("table"):
        cat = detect_category(nearest_heading_text(tbl))
        if not cat:
            continue
        for label, price in parse_table_to_items(tbl):
            # gold/platinum/silver のよく使うラベル以外はスキップ（行見出しが列合計などのケース対策）
            if cat == "gold" and not (label.startswith("K")):
                continue
            if cat == "platinum" and not (label.startswith("PT")):
                continue
            if cat == "palladium" and not label.startswith("PD"):
                continue
            if cat == "silver" and not label.startswith("SV"):
                continue
            # コンビは任意の行をそのまま拾う
            sections[cat].append(build_record(label, price, dealer_factor, general_factor))

    # --- 最低限の保険：もしPdが拾えなかったら、PD1000を空で入れない（UI側は存在しないだけでOK） ---

    payload = {
        "date": datetime.now(timezone(timedelta(hours=9))).strftime("%Y-%m-%d"),
        "generated_at": jst_now_iso(),
        "source": URL,
        "policy": {"dealer_factor": dealer_factor, "general_factor": general_factor},
        "sections": sections,
    }
    return payload

def main():
    data = scrape()
    ensure_dir("data/today_market.json")
    with open("data/today_market.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    main()
