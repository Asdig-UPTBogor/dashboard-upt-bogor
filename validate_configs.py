#!/usr/bin/env python3
"""Validate per-page JSON configs vs page-data API responses."""
import json, os, glob, urllib.request

BASE_URL = "http://localhost:3000"
CONFIGS_DIR = os.path.join(os.path.dirname(__file__), "src/lib/page-configs")

def fetch(page):
    try:
        url = f"{BASE_URL}/api/page-data?page={page}&refresh=true"
        with urllib.request.urlopen(url, timeout=30) as r:
            return json.loads(r.read())
    except Exception as e:
        return {"error": str(e), "sheets": []}

configs = sorted(glob.glob(os.path.join(CONFIGS_DIR, "*.json")))
print(f"{'='*60}")
print(f"CONFIG VALIDATOR — {len(configs)} configs")
print(f"{'='*60}")

ok = 0; issues = 0

for cp in configs:
    with open(cp) as f:
        cfg = json.load(f)
    page = cfg["page"]
    sources = cfg.get("dataSources", [])
    print(f"\n--- {os.path.basename(cp)} → {page} ({len(sources)} sources) ---")

    api = fetch(page)
    if "error" in api and not api.get("sheets"):
        print(f"  X API ERROR: {api['error']}")
        issues += 1
        continue

    api_map = {s["sheetName"]: s for s in api.get("sheets", [])}

    for ds in sources:
        sn = ds["sheetName"]
        cfg_cols = [c["name"] for c in ds.get("columnsUsed", [])]
        s = api_map.get(sn)
        if not s:
            print(f"  X Sheet '{sn}' not in API response")
            issues += 1
            continue

        mc = s.get("missingColumns", [])
        err = s.get("error")
        rc = s.get("rowCount", 0)
        hc = len(s.get("headers", []))

        if mc or err:
            print(f"  WARN {sn}: {rc} rows, {hc}/{len(cfg_cols)} cols")
            if err:
                print(f"     Error: {err}")
            for m in mc:
                print(f"     X '{m['name']}' (pos={m['configPos']}) -> {m['reason']}")
            issues += 1
        else:
            print(f"  OK {sn}: {rc} rows, {hc}/{len(cfg_cols)} cols — ALL MATCH")
            ok += 1

print(f"\n{'='*60}")
print(f"RESULT: {ok} OK, {issues} issues")
print(f"{'='*60}")
