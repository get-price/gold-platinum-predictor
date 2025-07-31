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
            if tag:
                parent = tag.find_parent(["div", "section", "td", "tr"]) or s
                price_text = parent.find(string=re.compile(r"[\d,]+円"))
                if price_text:
                    raw = to_int(str(price_text))
                    vals[metal] = raw

        if not vals:
            return None

        items = []
        for metal, source in vals.items():
            dealer = round(source * 0.98)
            general = round(dealer * 0.97)
            items.append({
                "metal": metal,
                "label": labels[metal].replace("買取価格（税込）", "インゴット"),
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
