import json
import os
from pathlib import Path
import requests

ROOT = Path(__file__).resolve().parents[1]
source = json.loads((ROOT / "data" / "ancira-south-park-nissan-suv-live.json").read_text())
raw = ROOT / "data" / "firecrawl" / "top-three-detail"
raw.mkdir(parents=True, exist_ok=True)

def env_file(path: Path) -> dict[str, str]:
    out = {}
    if path.exists():
        for line in path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                out[k.strip()] = v.strip().strip('"').strip("'")
    return out

env = {**env_file(ROOT / '.env.local'), **os.environ}
key = env.get('FIRECRAWL_API_KEY')
if not key:
    raise SystemExit('FIRECRAWL_API_KEY is not configured')
endpoint = (env.get('FIRECRAWL_API_URL') or 'https://api.firecrawl.dev/v1').rstrip('/') + '/scrape'
s = requests.Session()
s.headers.update({'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'})
checks = []
for idx, vin in enumerate(source['top_three'], 1):
    vehicle = next(v for v in source['vehicles'] if v['vin'] == vin)
    r = s.post(endpoint, json={'url': vehicle['source_url'], 'formats': ['markdown'], 'onlyMainContent': True}, timeout=120)
    r.raise_for_status()
    data = r.json()
    markdown = (data.get('data') or {}).get('markdown') or ''
    (raw / f'{idx}-{vehicle["stock_number"]}.md').write_text(markdown)
    checks.append({'rank': idx, 'vin': vin, 'stock': vehicle['stock_number'], 'status': r.status_code, 'chars': len(markdown), 'vin_present': vin in markdown, 'price_present': str(vehicle['ancira_price']) in markdown.replace(',', '')})
print(json.dumps(checks, indent=2))
