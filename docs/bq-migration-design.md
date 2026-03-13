# 🏗️ Architecture: BQ External Table Migration

> **Status:** APPROVED — Ready for execution
> **Date:** 2026-03-13
> **Scope:** Full dashboard data layer redesign

---

## 1. Problem Statement

Current system has too many moving parts:
- Worker CR service (22 JS files, always-on, costs $$$)
- Cloud Scheduler (triggering worker every 2 min)
- Proxy auth (OIDC tokens, IAM bindings)
- Config spread across: JSON files, Firestore, GCP Console
- Every config change requires deploy

## 2. New Architecture

```
BEFORE (4 components):
  Sheet → Worker → BQ snapshot table → Dashboard

AFTER (2 components):
  Sheet → BQ External Table → BQ View (QC) → Dashboard
```

### Data Layer (BQ)
```
┌─────────────────────────────────────────────────────┐
│  External Tables (1 per sheet = 22 tables)          │
│  ext_mtu_trafo, ext_master_gi, ext_data_petir, ...  │
│  → "windows" into spreadsheets, zero maintenance    │
├─────────────────────────────────────────────────────┤
│  Views (1+ per page = ~16 views)                    │
│  v_overview_mtu, v_hi_trafo, v_petir_data, ...      │
│  → JOINs, QC flags, hierarchy validation, filters   │
└─────────────────────────────────────────────────────┘
```

### Page Config (Firestore)
```json
{
  "page": "overview",
  "label": "Overview",
  "views": [
    { "name": "v_overview_mtu_trafo", "label": "MTU Trafo" },
    { "name": "v_overview_gi_summary", "label": "GI Summary" }
  ],
  "updatedAt": "2026-03-13T16:00:00Z"
}
```

> [!IMPORTANT]
> Page configs move from JSON files (`src/lib/page-configs/*.json`) to **Firestore** (`dashboard_meta/page_configs/{slug}`). No deploy needed for config changes.

### Dashboard API
```
/api/page-data?page=overview
  1. Read Firestore → get view names for this page
  2. Query BQ views → get data
  3. Return to FE (same format as before)
```

### DC (Data Connector) — Simplified
```
OLD: 6-step wizard (pick spreadsheet → pick sheet → pick columns → set hierarchy → set relations → save JSON)
NEW: 2-3 step wizard (pick BQ table → assign to page → save to Firestore)
```

### DSM (Data Source Manager) — Simplified  
```
OLD: Sheets API health check (slow, complex)
NEW: BQ INFORMATION_SCHEMA check (fast, simple)
```

---

## 3. BQ View Pattern — Hierarchy QC

Every view includes hierarchy validation via LEFT JOIN:

```sql
CREATE OR REPLACE VIEW `dashboard_warehouse.v_hi_trafo` AS
SELECT 
  t.*,
  CASE 
    WHEN t.`Master Gardu Induk` IS NULL OR t.`Master Gardu Induk` = '' 
      THEN 'MISSING_GI'
    WHEN g.`Nama GI` IS NULL 
      THEN 'ORPHAN_GI'
    ELSE 'OK'
  END AS qc_hierarchy,
  COALESCE(g.`ULTG`, t.`Master ULTG`) AS resolved_ultg
FROM `dashboard_warehouse.ext_mtu_trafo` t
LEFT JOIN `dashboard_warehouse.ext_master_gi` g
  ON UPPER(TRIM(t.`Master Gardu Induk`)) = UPPER(TRIM(g.`Nama GI`));
```

---

## 4. RULES Changes

| Rule | Old | New |
|---|---|---|
| **Data Flow** | Sheet → Worker → BQ → Dashboard | Sheet → BQ External Table → BQ View → Dashboard |
| **usePageData** | Still required ✅ | Still required ✅ (no change) |
| **DataFreshness** | Still required ✅ | Still required ✅ (no change) |
| **useChartTheme** | Still required ✅ | Still required ✅ (no change) |
| **Page Config** | JSON in `page-configs/*.json` | **Firestore** `dashboard_meta/page_configs/{slug}` |
| **spreadsheet-config.json** | Required | **DELETED** |
| **Column mapping** | Manual in DC + config | **Auto** from BQ schema |
| **Hierarchy QC** | JS in worker | **SQL** in BQ Views |
| **DC wizard** | 6 steps, writes JSON | 2-3 steps, writes Firestore |
| **DSM health** | Sheets API drift check | BQ INFORMATION_SCHEMA check |
| **Sidebar config** | Still required ✅ | Still required ✅ |
| **Chart standards** | Still required ✅ | Still required ✅ |

---

## 5. What Gets Deleted

- `Dashboard Sync Worker/` — entire service
- Cloud Scheduler job `dashboard-sync-trigger`
- `src/lib/spreadsheet-config.json`
- `src/lib/page-configs/*.json` (16 files → Firestore)
- `src/lib/dashboard-sync-worker.ts`
- `src/app/api/worker-control/`
- `src/app/api/dashboard-sync/`
- `src/app/maintenance/worker-sync/`
- Firestore `sync_worker_status` doc

## 6. What Stays the Same

- `usePageData` hook + `DataFreshness` + `useChartTheme`
- All page components (`page.tsx` files)
- Sidebar config
- Chart style standards (donut, color palette)
- shadcn/ui components
- Column naming convention (`Master ULTG`, `Master Gardu Induk`)

---

## 7. Migration Phases

### Phase 1: BQ Setup (no code changes)
- [ ] Share 5 spreadsheets to BQ service account
- [ ] Create 22 external tables (SQL script)
- [ ] Create ~16 BQ views with QC (SQL script)
- [ ] Verify data matches current dashboard

### Phase 2: Dashboard Data Layer (local dev first)
- [ ] New `bigquery-direct.ts` — query BQ views directly
- [ ] New `page-config-firestore.ts` — read/write page configs from Firestore
- [ ] Migrate 16 page configs from JSON → Firestore
- [ ] Update `/api/page-data/route.ts` — use new data layer
- [ ] Test locally: `npm run dev` → all pages show correct data
- [ ] Build test: `npx next build` passes

### Phase 3: DC/DSM Simplification (local dev)
- [ ] Simplify DC wizard (2-3 steps, writes to Firestore)
- [ ] Simplify DSM (BQ INFORMATION_SCHEMA health check)
- [ ] Test locally

### Phase 4: Deploy + Verify
- [ ] Deploy dashboard to CR
- [ ] Verify all pages work on production
- [ ] Monitor for 24h

### Phase 5: Cleanup
- [ ] Delete worker CR service
- [ ] Delete Cloud Scheduler job
- [ ] Remove dead code (worker proxy, old configs)
- [ ] Update RULES.md with new rules

---

## 8. Local vs Cloud Run Compatibility

| Concern | Solution |
|---|---|
| BQ auth local | `google-auth/key.json` (ADC) — already works |
| BQ auth CR | Service account ADC — already works |
| Firestore local | Same key file — already works |
| Firestore CR | ADC — already works |
| External Table access | BQ SA has Viewer on spreadsheets — same SA for both |

> [!TIP]
> No env-specific code needed. Same code runs locally and on CR via ADC.
