"""BQ Inspector — quick CLI to check datasets/tables/columns."""
import json, sys, urllib.request
from google.oauth2 import service_account
import google.auth.transport.requests

PROJECT = "gcp-bridge-meshvpn"
KEY = "google-auth/key.json"

def auth():
    c = service_account.Credentials.from_service_account_file(KEY, scopes=["https://www.googleapis.com/auth/bigquery.readonly"])
    c.refresh(google.auth.transport.requests.Request())
    return c.token

def bq_get(path, token):
    url = f"https://bigquery.googleapis.com/bigquery/v2/projects/{PROJECT}/{path}"
    return json.loads(urllib.request.urlopen(urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})).read())

def cmd_list(token):
    """List all datasets with e_/v_/n_ table counts."""
    for ds in bq_get("datasets", token).get("datasets", []):
        did = ds["datasetReference"]["datasetId"]
        tables = bq_get(f"datasets/{did}/tables?maxResults=200", token).get("tables", [])
        e = sum(1 for t in tables if t["tableReference"]["tableId"].startswith("e_"))
        v = sum(1 for t in tables if t["tableReference"]["tableId"].startswith("v_"))
        n = sum(1 for t in tables if t["tableReference"]["tableId"].startswith("n_"))
        o = len(tables) - e - v - n
        print(f"📦 {did}: e_={e} v_={v} n_={n} other={o} (total={len(tables)})")

def cmd_tables(token, dataset):
    """List all tables in a dataset."""
    tables = bq_get(f"datasets/{dataset}/tables?maxResults=200", token).get("tables", [])
    for t in sorted(tables, key=lambda x: x["tableReference"]["tableId"]):
        tid = t["tableReference"]["tableId"]
        print(f"  {tid} ({t.get('type','?')})")
    print(f"\nTotal: {len(tables)}")

def cmd_cols(token, dataset, table):
    """Show columns of a specific table."""
    t = bq_get(f"datasets/{dataset}/tables/{table}", token)
    schema = t.get("schema", {}).get("fields", [])
    rows = t.get("numRows", "?")
    print(f"{dataset}.{table} — {rows} rows, {len(schema)} cols:")
    for f in schema:
        print(f"  {f['name']} ({f.get('type','?')})")

def cmd_check(token, dataset, sheet_name):
    """Check if e_/v_/n_ triplet exists for a sheet name."""
    tables = bq_get(f"datasets/{dataset}/tables?maxResults=200", token).get("tables", [])
    tids = {t["tableReference"]["tableId"] for t in tables}
    norm = sheet_name.replace(" ", "_").replace(".", "_")
    for prefix in ["e_", "v_", "n_"]:
        name = f"{prefix}{norm}"
        status = "✅" if name in tids else "❌ MISSING"
        print(f"  {name}: {status}")

if __name__ == "__main__":
    args = sys.argv[1:]
    if not args:
        print("Usage:")
        print("  python bq_inspect.py list                     — list all datasets")
        print("  python bq_inspect.py tables <dataset>          — list tables in dataset")
        print("  python bq_inspect.py cols <dataset> <table>    — show columns")
        print("  python bq_inspect.py check <dataset> <sheet>   — check e_/v_/n_ triplet")
        sys.exit(0)
    
    token = auth()
    cmd = args[0]
    if cmd == "list": cmd_list(token)
    elif cmd == "tables" and len(args) > 1: cmd_tables(token, args[1])
    elif cmd == "cols" and len(args) > 2: cmd_cols(token, args[1], args[2])
    elif cmd == "check" and len(args) > 2: cmd_check(token, args[1], " ".join(args[2:]))
    else: print("Unknown command. Run without args for help.")
