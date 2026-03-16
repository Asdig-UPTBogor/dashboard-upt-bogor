#!/bin/bash
# audit-bq-current-state.sh
# Audit semua BQ datasets dan tables di project gcp-bridge-meshvpn
# Usage: bash utils/audit-bq-current-state.sh

PROJECT="gcp-bridge-meshvpn"

echo "======================================================================"
echo "📦 BQ Audit: $PROJECT"
echo "======================================================================"

# List datasets
echo ""
echo "--- DATASETS ---"
DATASETS=$(bq ls --project_id=$PROJECT --format=json 2>/dev/null | python3 -c "
import json,sys
data=json.load(sys.stdin)
for d in data:
    print(d['datasetReference']['datasetId'])
")

echo "$DATASETS"
echo ""

# For each dataset, list tables
for DS in $DATASETS; do
    echo "======================================================================"
    echo "📦 Dataset: $DS"
    echo "======================================================================"
    
    TABLES=$(bq ls --project_id=$PROJECT "$DS" --format=json 2>/dev/null)
    
    if [ -z "$TABLES" ] || [ "$TABLES" = "[]" ]; then
        echo "  (empty dataset)"
        continue
    fi
    
    python3 -c "
import json,sys
tables=json.loads('''$TABLES''')
ext = [t for t in tables if t['tableReference']['tableId'].startswith('e_')]
views = [t for t in tables if t['tableReference']['tableId'].startswith('v_')]
native = [t for t in tables if t['tableReference']['tableId'].startswith('n_')]
other = [t for t in tables if not t['tableReference']['tableId'].startswith(('e_','v_','n_'))]

print(f'  Total: {len(tables)} tables')
if ext:
    print(f'  External (e_): {len(ext)}')
    for t in ext: print(f\"    {t['tableReference']['tableId']} [{t.get('type','?')}]\")
if views:
    print(f'  Views (v_): {len(views)}')
    for t in views: print(f\"    {t['tableReference']['tableId']} [{t.get('type','?')}]\")
if native:
    print(f'  Native (n_): {len(native)}')
    for t in native: print(f\"    {t['tableReference']['tableId']} [{t.get('type','?')}]\")
if other:
    print(f'  Other: {len(other)}')
    for t in other: print(f\"    {t['tableReference']['tableId']} [{t.get('type','?')}]\")
" 2>/dev/null
    echo ""
done
