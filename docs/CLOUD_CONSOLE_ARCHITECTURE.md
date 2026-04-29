# Cloud Console — Architecture & Context

> Dokumentasi arsitektur Cloud Console di Dashboard UPT Bogor.
> Dibaca oleh agent sebelum kerja di area `cloud-console/` atau `api/console/`.

---

## Apa Itu Cloud Console?

Cloud Console adalah **control center** di dalam Dashboard untuk memonitor dan mengontrol semua cloud service (Cloud Function, Cloud Run) milik platform UPT Bogor. Analoginya: Google Cloud Console versi internal, khusus untuk service kita sendiri.

**Fungsi utama:**
1. **Monitor** — lihat status, config, logs semua service secara real-time
2. **Control** — pause/resume scheduler, trigger manual, ubah config, test send
3. **Observe** — unified log stream dari semua service dalam 1 panel

---

## Arsitektur

```
┌─────────────────────────────────────────────────────────────┐
│                    BROWSER (Client)                          │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ ServiceExplorer│  │  Service Page │  │ LogPanel (per svc)│  │
│  │ (sidebar)     │  │  (center)     │  │ (right, 300px)   │  │
│  │               │  │               │  │                   │  │
│  │ Checkbox →    │  │ Thor Vaisala  │  │ SSE stream ←──────┤──┤── /api/console/logs/stream
│  │ toggle log    │  │ Notifier      │  │ Backfill ←────────┤──┤── /api/console/logs/{id}
│  │               │  │ Spreadsheet   │  │                   │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────────┘  │
│         │                  │                                  │
│  Firestore onSnapshot     │ REST API calls                   │
│  (real-time config)       │                                  │
└─────────┬─────────────────┼──────────────────────────────────┘
          │                  │
          ▼                  ▼
┌─────────────────┐  ┌──────────────────────────────────────┐
│ Firebase Client  │  │ API Routes (/api/console/)            │
│ SDK (browser)    │  │                                       │
│                  │  │  /services           → GET registry    │
│ Collections:     │  │  /services/{id}/config  → GET/POST    │
│ - service_       │  │  /services/{id}/control → POST        │
│   runtime_       │  │  /services/{id}/actions/{action}      │
│   configs        │  │  /logs/{id}          → GET backfill   │
│ - data_sources   │  │  /logs/stream        → GET SSE        │
│                  │  │                                       │
└─────────────────┘  └──────────────┬───────────────────────┘
                                     │ Server-side (Node.js)
                                     ▼
                     ┌───────────────────────────────────────┐
                     │ GCP SDK Layer (_lib/)                  │
                     │                                        │
                     │  firestore.ts  → @google-cloud/firestore│
                     │  logging.ts    → @google-cloud/logging  │
                     │  cloud-run.ts  → @google-cloud/run      │
                     │  scheduler.ts  → @google-cloud/scheduler│
                     │  auth.ts       → google-auth-library    │
                     │                                        │
                     │ Actions route juga pakai:               │
                     │  @google-cloud/pubsub (Eventarc)        │
                     │  @google-cloud/secret-manager           │
                     │  googleapis (Sheets API)                │
                     └───────────────────────────────────────┘
```

---

## File Map

### Frontend (FE)

```
src/app/cloud-console/
├── layout.tsx                      # Layout utama: Explorer | Content | LogPanels
│                                   # SSE connection, log state machine, inject/refresh
├── page.tsx                        # Redirect → /spreadsheet-sync
├── overview/page.tsx               # Overview: semua service cards
│
├── _components/
│   ├── FirestoreProvider.tsx        # Context: onSnapshot service_runtime_configs + data_sources
│   ├── useFirestore.ts             # Hooks: useFirestoreConfig, useFirestoreRegistry, useServiceInfo
│   ├── ServiceExplorer.tsx         # Sidebar: list service + checkbox log toggle
│   ├── LogPanel.tsx                # Log viewer per service (Drizzle Studio style)
│   ├── LogContext.tsx              # Context: injectLog + refreshLogs (layout → service page)
│   └── service-ui/
│       ├── index.ts                # Re-export semua
│       ├── ServiceHeader.tsx       # Header: title, subtitle, icon, health status
│       ├── ServiceTabs.tsx         # Tab navigation
│       └── ServicePrimitives.tsx   # StatCard, Section, Grid, InputField, DisplayField, Toast, Skeleton
│
├── _lib/
│   └── service-icons.ts            # Icon resolver per service
│
├── thor-vaisala/
│   ├── page.tsx                    # Thor Gen3 — 5 tabs (Config, Enrichment, Operations, Spec, Notifier)
│   ├── _lib/types.ts               # ThorConfig type
│   ├── _lib/api.ts                 # fmtBool, fmtWIB, fmtAgo helpers
│   └── _components/
│       ├── TabConfig.tsx           # Editable config (column mapping, API settings)
│       ├── TabEnrichment.tsx       # Dynamic source manager
│       ├── TabOperations.tsx       # Runtime + Validation sub-tabs
│       ├── TabSpecInfra.tsx        # Cold-start metadata, Cloud Run info
│       └── TabNotifier.tsx         # Pub/Sub alert status
│
├── notifier/
│   └── page.tsx                    # Notifier V2 — 5 tabs (Status, Groups, Provider, Logs, Settings)
│
└── spreadsheet-sync/
    └── page.tsx                    # Spreadsheet Sync — 3 tabs (Control, Detail, Settings)
```

### Backend (API Routes)

```
src/app/api/console/
├── services/
│   ├── route.ts                    # GET /services → registry dari Firestore
│   └── [id]/
│       ├── config/route.ts         # GET/POST config + Cloud Logging write
│       ├── control/route.ts        # POST scheduler actions (pause/resume/trigger/interval)
│       └── actions/[action]/route.ts # Service-specific actions (test-send, sync-now, etc)
│
├── logs/
│   ├── [serviceId]/route.ts        # GET logs per service (backfill)
│   └── stream/route.ts             # GET SSE unified log stream (backfill + tail)
│
└── _lib/
    ├── firestore.ts                # Firestore client, registry, config CRUD
    ├── logging.ts                  # Cloud Logging query, write, normalize
    ├── cloud-run.ts                # Cloud Run service info
    ├── scheduler.ts                # Cloud Scheduler pause/resume/trigger
    └── auth.ts                     # OIDC auth for calling other Cloud Run services
```

---

## Konsep Kunci

### 1. Registry-Driven

Semua service terdaftar di Firestore collection `service_runtime_configs`, document `cloud_console`:

```json
{
  "services": {
    "spreadsheet-sync": {
      "name": "Spreadsheet Sync",
      "logServiceName": "sheet-bq-sync",
      "serviceType": "cloud_function",
      "configCollection": "service_runtime_configs",
      "configDocument": "sheet_bq_sync",
      "schedulerJobId": "sheet-bq-sync-trigger",
      "icon": "Table2",
      "color": "text-blue-400",
      "status": "active"
    },
    "thor-gen3": { ... },
    "notifier": { ... }
  }
}
```

**Tidak ada hardcode service list di FE.** Semua dibaca dari Firestore → FE auto-render.

### 2. Dual Data Path

| Path | Teknologi | Kegunaan |
|------|-----------|----------|
| **Real-time config** | Firebase Client SDK (`onSnapshot`) | FE langsung dapat update saat config berubah (tanpa polling) |
| **Actions & control** | REST API (`/api/console/*`) | Write operations, scheduler control, log queries |

**Kenapa dua path?**
- `onSnapshot` = instant UI update tanpa refresh (config changes, scheduler state)
- REST API = server-side operations yang butuh GCP SDK (Scheduler, Logging, Pub/Sub)

### 3. Unified Log Stream (SSE)

```
Layout.tsx                          /api/console/logs/stream
    │                                       │
    │── EventSource connect ──────────────►│
    │                                       │── Backfill (getEntries, 30 min)
    │◄── backfill entries ─────────────────│
    │◄── status: backfill_complete ────────│
    │                                       │── Tail (tailEntries, gRPC duplex)
    │◄── status: tail_started ─────────────│
    │◄── real-time entries ────────────────│
    │◄── status: heartbeat (15s) ──────────│
    │                                       │
    │   [tail error]                        │── Auto-retry (exponential backoff)
    │◄── status: tail_retrying ────────────│
    │◄── gap backfill ─────────────────────│
    │◄── status: tail_started ─────────────│
    │                                       │
    │   [55 min lifetime]                   │
    │◄── status: stream_expired ───────────│
    │── reconnect + re-backfill ──────────►│
```

**State machine di FE:**
```
connecting → backfilling → tailing → [retrying → tailing] → [failed]
                                    → [stale (5min no data)]
```

**Self-healing features:**
- Auto-retry tail dengan exponential backoff (max 5 retries)
- Gap backfill saat reconnect (fetch entries dari lastTimestamp)
- gRPC keepalive (60s PING) untuk prevent idle disconnect
- Max lifetime 55 min, lalu reconnect otomatis
- Stale detection (5 min tanpa data)

### 4. Service Page Pattern (YGGDRASIL Standard)

Setiap service page mengikuti pattern yang sama:

```tsx
// 1. Data dari Firestore (real-time)
const config = useFirestoreConfig<ConfigType>('service_doc_id');
const svcInfo = useServiceInfo('route-path');

// 2. Header (dari registry, konsisten dengan sidebar)
<ServiceHeader title={svcInfo.name} subtitle={svcInfo.subtitle} health={...} />

// 3. Status Bar (read-only badges)
<div className="border-y border-border py-3 mb-6">...</div>

// 4. Tabs
<ServiceTabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

// 5. Tab Content
{activeTab === "config" && <TabConfig config={config} />}
```

### 5. Service Actions

| Service | Action | Method | Fungsi |
|---------|--------|--------|--------|
| notifier | `test-send` | POST | Kirim test message via Eventarc → Notifier CF |
| notifier | `verify-group` | POST | Sync WA group metadata dari MaxChat API |
| spreadsheet-sync | `sync-now` | POST | Trigger manual sync (blocking) |
| thor-gen3 | `test-connection` | POST | Test koneksi ke Trion API |
| (shared) | `load-sheets` | POST | Load sheet names dari Google Spreadsheet |
| (shared) | `load-headers` | POST | Load header row + row count |

### 6. Config Write Flow

```
FE save button
  → POST /api/console/services/{id}/config
    → updateConfig() (Firestore merge write)
    → readConfig() (verify consistency)
    → writeLog() (Cloud Logging — appears in LogPanel)
    → Response { ok, verified, mismatches }

Meanwhile:
  Firestore onSnapshot triggers → FE auto-updates (no refresh needed)
```

### 7. Scheduler Control Flow

```
FE pause/resume/trigger
  → POST /api/console/services/{id}/control { action: "pause" }
    → SDK call (pauseJob/resumeJob/triggerJob)
    → syncSchedulerState() → write scheduler_* fields to Firestore
    → writeLog() → Cloud Logging
    → Response

Meanwhile:
  scheduler_* fields updated → onSnapshot → FE status bar updates instantly
```

---

## Shared UI Components (service-ui/)

| Component | Fungsi | Kapan |
|-----------|--------|-------|
| `ServiceHeader` | Page header dengan icon, title, health dot | Setiap service page |
| `ServiceTabs` | Tab navigation | Setiap service page |
| `ServiceSection` | Collapsible section wrapper | Group config fields |
| `ServiceGrid` | Property-value grid (label: value) | Config display |
| `ServiceStatCard` | Metric card (icon + label + value) | Status/summary |
| `InputField` | Text input dengan sensitive toggle | Config edit |
| `DisplayField` | Read-only field (mono, truncated) | Config display |
| `ServiceToast` | Feedback toast (success/error) | After actions |
| `ServiceSkeleton` | Loading state | Initial load |

---

## Firestore Collections

| Collection | Document | Fungsi |
|-----------|----------|--------|
| `service_runtime_configs` | `cloud_console` | Registry: daftar semua service + metadata |
| `service_runtime_configs` | `sheet_bq_sync` | Config: Spreadsheet Sync |
| `service_runtime_configs` | `thor_vaisala` | Config: Thor Gen3 |
| `service_runtime_configs` | `notifier` | Config: Notifier |
| `data_sources` | `{spreadsheet_id}` | Metadata spreadsheet + sheet mapping |

---

## Menambah Service Baru

1. **Daftarkan di Firestore** `service_runtime_configs/cloud_console.services.{id}`
2. **Buat config doc** di `service_runtime_configs/{config_doc_id}`
3. **Buat page** di `src/app/cloud-console/{route-path}/page.tsx`
4. **Ikuti pattern:** `useFirestoreConfig` + `ServiceHeader` + `ServiceTabs`
5. **Tambah actions** di `api/console/services/[id]/actions/[action]/route.ts` kalau perlu
6. Log otomatis masuk via unified stream (selama `logServiceName` benar)
