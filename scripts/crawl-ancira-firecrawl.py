import json
import os
import re
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "firecrawl" / "south-park-nissan-suv"
RAW.mkdir(parents=True, exist_ok=True)

# Parse only simple KEY=value lines; do not source .env.local because it may
# contain non-shell-safe metadata lines.
def env_file(path: Path) -> dict[str, str]:
    values = {}
    if not path.exists():
        return values
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values

env = {**env_file(ROOT / ".env.local"), **os.environ}
key = env.get("FIRECRAWL_API_KEY", "")
if not key:
    raise SystemExit("FIRECRAWL_API_KEY is not configured")

endpoint = env.get("FIRECRAWL_API_URL") or "https://api.firecrawl.dev/v1"
endpoint = endpoint.rstrip("/") + "/scrape"
base = "https://www.southparknissan.com/new-nissan-san-antonio-tx/suv-crossover/"

session = requests.Session()
session.headers.update({"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
results = []
for page in range(1, 16):
    url = base if page == 1 else f"{base}?_p={page}"
    print(f"scraping page {page}/15", flush=True)
    response = session.post(endpoint, json={"url": url, "formats": ["markdown"], "onlyMainContent": True}, timeout=120)
    response.raise_for_status()
    payload = response.json()
    if not payload.get("success"):
        raise RuntimeError(f"Firecrawl failed for page {page}: {payload}")
    data = payload.get("data") or {}
    markdown = data.get("markdown") or ""
    (RAW / f"page-{page:02d}.md").write_text(markdown)
    results.append({"page": page, "url": url, "chars": len(markdown), "records_seen": len(re.findall(r"VIN:\s+([A-HJ-NPR-Z0-9]{17})", markdown))})
    time.sleep(1)

(RAW / "manifest.json").write_text(json.dumps({"source": base, "pages": results}, indent=2))
print(json.dumps(results, indent=2))
