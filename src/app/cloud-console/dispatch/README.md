# Dispatch FE — Cloud Console

Foundation untuk Dispatch control center. Thin orchestrator pattern.

## Structure

```
dispatch/
├── page.tsx                      Thin orchestrator — header + status bar + tab router
├── README.md                     Ini
├── _config/
│   └── tabs.ts                   Tab registry (id, label, icon, domain text) — single source of truth
├── _hooks/
│   └── useProviderStatus.ts      Fetch + cache live status WaGate + WAHA, 30s refresh
├── _lib/
│   ├── api.ts                    Fetch helpers (getWahaStatus, getWagateStatus, patchConfig, swapProviders, dll)
│   ├── types.ts                  DispatchConfig, DispatchGroup, WahaStatus, DeliveryLogRow, dll
│   └── selectors.ts              Pure function derive state dari config (resolveProviders, resolveHealth, dll)
├── _components/
│   ├── primitives/
│   │   ├── InfoHeader.tsx        Domain explainer per tab (title + description + source)
│   │   ├── StatusDot.tsx         Semantic status indicator
│   │   └── ProviderCard.tsx      Card buat display provider (primary/secondary/future variant)
│   ├── flow/
│   │   └── FlowDiagram.tsx       Architecture flow visualization
│   ├── TabStatus.tsx             Compose: InfoHeader + FlowDiagram + ProviderCards + counters + ServiceSection
│   ├── TabProvider.tsx           Kontrol provider (swap + restart + refresh)
│   ├── TabGroups.tsx             CRUD mapping group alias → chatId
│   ├── TabLogs.tsx               BQ delivery_log viewer
│   ├── TabInbound.tsx            BQ message_log + event_log viewer
│   └── TabSettings.tsx           Kill switch + test send + runtime config
```

## Design principles

1. **Zero hardcode data** — nama topic, capability, primary/secondary, bot info — semua dari Firestore / live API. Jangan tulis "notifier-send" atau "WaGate Core" literal di JSX.
2. **Selectors** — logic derive state terpusat di `_lib/selectors.ts`. Component cuma render, tidak compute.
3. **Primitives reusable** — `InfoHeader`, `StatusDot`, `ProviderCard` dipakai berulang. Tambah fitur UI baru: extend primitives, jangan copy-paste CSS.
4. **Hooks untuk data** — `useProviderStatus` fetch sekali di page root, pass via prop ke tab. Tidak tiap tab fetch sendiri.
5. **Tab registry** — tambah tab: push ke `DISPATCH_TABS` di `_config/tabs.ts` + add case di `page.tsx`. Info domain otomatis render via `InfoHeader` dari definisi tab.
6. **Design tokens** — pakai `ds-label` (12px medium), `ds-small` (12px muted), `ds-title` (16px bold), `ds-data` (12px mono bold). Color semantic via Tailwind: `text-emerald-400` (ok), `text-red-400` (err), `text-amber-400` (warn), `text-primary` (action), `text-muted-foreground` (neutral).

## Extend

### Tambah tab baru

1. `_config/tabs.ts` → push object ke `DISPATCH_TABS`:
   ```ts
   {
       id: 'metrics',
       label: 'Metrics',
       icon: BarChart,
       domain: 'Grafik throughput & latency per gateway.',
       source: 'BigQuery dispatch.delivery_log (aggregated)',
   }
   ```
2. `_components/TabMetrics.tsx` → create component (compose primitives).
3. `page.tsx` → add `{activeTab === 'metrics' && <TabMetrics ... />}`.

### Tambah primitive UI

Taruh di `_components/primitives/` + export dari `index.ts`. Pattern: pure function component, props-only, no internal fetching.

### Tambah field selector

Baru computed state dari config? Tambah function di `_lib/selectors.ts`. Pure function. Unit-testable.

## Realtime flow (future)

Architecture flow di `FlowDiagram` sudah siap untuk realtime animation:
- Tiap node punya `data-flownode` attribute
- Subscribe Firestore onSnapshot ke doc dengan event log rolling (atau BQ streaming via server-sent-events)
- CSS animation pulse pada node yang aktif saat event baru datang

Bukan prioritas MVP. Static view + auto-refresh 30s (via useProviderStatus) cukup dulu.
