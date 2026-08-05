import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "firecrawl" / "south-park-nissan-suv"
OUT = ROOT / "data" / "ancira-south-park-nissan-suv-live.json"


def money(value: str | None) -> int | None:
    return int(value.replace(",", "")) if value else None


def first(pattern: str, block: str) -> str | None:
    match = re.search(pattern, block, re.I | re.S)
    return match.group(1).strip() if match else None

records: dict[str, dict] = {}
for page_path in sorted(RAW.glob("page-*.md")):
    markdown = page_path.read_text()
    blocks = re.findall(r"\[!\[(.*?)\]\((.*?)\)\]\((https?://[^)]+/inventory/[^)]+)\)(.*?)(?=\n\[!\[|\Z)", markdown, re.S)
    for image_title, image_url, detail_url, rest in blocks:
        block = f"{image_title}\n{rest}"
        vin = first(r"VIN:\s*([A-HJ-NPR-Z0-9]{17})", block)
        if not vin:
            continue
        title = re.sub(r"\s+", " ", image_title).strip()
        parts = title.split()
        year = int(parts[0]) if parts and parts[0].isdigit() else None
        make = parts[1] if len(parts) > 1 else None
        model = parts[2] if len(parts) > 2 else None
        trim = " ".join(parts[3:]) or None
        stock = first(r"•\s*([A-Z0-9]+)", block)
        msrp = money(first(r"MSRP\s*\$([0-9,]+)", block))
        savings = money(first(r"Ancira Savings\s*\$([0-9,]+)", block))
        ancira_price = money(first(r"Ancira Price.*?\$([0-9,]+)", block))
        customer_cash = money(first(r"Nissan Customer Cash\s*\$([0-9,]+)", block))
        doc_fee = money(first(r"Doc Fee\s*\$([0-9,]+)", block))
        deputy_fee = money(first(r"Deputy Fee\s*\$([0-9,]+)", block))
        offers = sorted(set(re.findall(r"(Nissan (?:Military Cash|College Grad|Customer Cash))\s*\$([0-9,]+)", block)))
        records[vin] = {
            "vin": vin,
            "stock_number": stock,
            "year": year,
            "make": make,
            "model": model,
            "trim": trim,
            "condition": "new",
            "vehicle_category": "suv",
            "msrp": msrp,
            "ancira_savings": savings,
            "customer_cash": customer_cash,
            "ancira_price": ancira_price,
            "doc_fee": doc_fee,
            "deputy_fee": deputy_fee,
            "image_url": image_url,
            "source_url": detail_url,
            "listing_page": f"https://www.southparknissan.com/new-nissan-san-antonio-tx/suv-crossover/{'' if page_path.stem == 'page-01' else '?_p=' + page_path.stem[-2:].lstrip('0')}",
            "conditional_offers": [f"{name} ${amount}" for name, amount in offers],
            "msrp_minus_ancira_price": (msrp - ancira_price) if msrp is not None and ancira_price is not None else None,
            "data_quality_notes": [
                "Listing-page extraction; detail page should be rechecked before publishing.",
                "Advertised price excludes taxes and fees listed by the dealer.",
            ],
        }

vehicles = list(records.values())
for vehicle in vehicles:
    gap = vehicle["msrp_minus_ancira_price"] or 0
    msrp = vehicle["msrp"] or 1
    savings = vehicle["ancira_savings"] or 0
    conditional_penalty = 4 if vehicle["customer_cash"] else 0
    vehicle["deal_score"] = round((gap / msrp) * 100 + (savings / msrp) * 50 - conditional_penalty, 2)
    vehicle["score_breakdown"] = {
        "value_gap_points": round((gap / msrp) * 100, 2),
        "savings_points": round((savings / msrp) * 50, 2),
        "conditional_offer_penalty": conditional_penalty,
    }

vehicles.sort(key=lambda item: item["deal_score"], reverse=True)
result = {
    "source": {
        "dealer_group": "Ancira Auto Group",
        "dealer_name": "South Park Nissan",
        "market": "San Antonio, Texas",
        "source_url": "https://www.southparknissan.com/new-nissan-san-antonio-tx/suv-crossover/",
        "pages_crawled": 15,
        "listing_slots_seen": 300,
        "unique_vehicles": len(vehicles),
        "notes": [
            "Rankings are listing-page signals, not dealer claims.",
            "Recheck each top vehicle detail page before publishing.",
        ],
    },
    "vehicles": vehicles,
    "top_three": [vehicle["vin"] for vehicle in vehicles[:3]],
}
OUT.write_text(json.dumps(result, indent=2))
print(json.dumps({
    "pages_crawled": 15,
    "listing_slots_seen": 300,
    "unique_vehicles": len(vehicles),
    "top_three": [
        {
            "rank": index + 1,
            "year": v["year"],
            "make": v["make"],
            "model": v["model"],
            "trim": v["trim"],
            "stock": v["stock_number"],
            "price": v["ancira_price"],
            "msrp": v["msrp"],
            "score": v["deal_score"],
            "source_url": v["source_url"],
        }
        for index, v in enumerate(vehicles[:3])
    ],
}, indent=2))
