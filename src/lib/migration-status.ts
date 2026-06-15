/**
 * migration-status.ts — Registry halaman yang MASIH baca data dari BigQuery.
 *
 * Konteks: migrasi bertahap BigQuery → Supabase Postgre. Halaman yang masih
 * pakai hook `usePageData()` (baca BQ via /api/page-data) perlu banner notifikasi
 * "Proses Migrasi" supaya user tahu page itu sedang dimigrasi.
 *
 * Halaman yang SUDAH pindah ke snapshot Supabase (hook `useSnapshot`) TIDAK
 * boleh masuk daftar ini — banner-nya jangan muncul.
 *
 * ── Cara nambah / ngurangin route saat page migrasi ──
 *   - Page baru yang masih BQ  → tambah entry di `BQ_PAGES`.
 *   - Page selesai migrasi ke  → HAPUS entry-nya dari `BQ_PAGES` (banner langsung
 *     Supabase                   hilang, tanpa sentuh komponen/layout).
 *   - Key = route prefix persis seperti yang muncul di `usePathname()`
 *     (path file route di src/app, BUKAN argumen string usePageData()).
 */

export interface BqPageMeta {
  /** Catatan opsional, tampil sebagai sub-teks tambahan di banner. */
  note?: string;
}

/**
 * Daftar route prefix yang MASIH baca BigQuery (perlu banner migrasi).
 *
 * Sumber: scan `usePageData` di `src/app/**​/page.tsx` + `**​/_components/*`
 * (beberapa page baca BQ lewat komponen tab di dalamnya, bukan di page.tsx).
 * DIKECUALIKAN:
 *   - /ce-next-level            → sudah pindah useSnapshot (Supabase)
 *   - /proteksi/program-kerja   → sudah pindah useSnapshot (Supabase)
 *   - /presentation/*           → view presentasi (dikerjakan agent lain)
 *   - /maintenance/*            → tool admin Data Input (BQ editor by design,
 *                                 bukan target migrasi snapshot Supabase)
 */
export const BQ_PAGES: Record<string, BqPageMeta> = {
  "/transmisi/asset": {},
  "/transmisi/row": {},
  "/transmisi/petir": {},
  "/transmisi/tower": {},
  "/gardu-induk/hi-trafo": {},
  "/gardu-induk/healthy-index": {},
  "/jadwal-pekerjaan": {},
  "/proteksi/asset": {},
};

export interface MigrationNoticeState {
  /** True kalau halaman ini masih baca BQ → banner harus tampil. */
  show: boolean;
  /** Catatan opsional dari config route. */
  note?: string;
}

/**
 * shouldShowMigrationNotice — cek apakah pathname saat ini perlu banner migrasi.
 *
 * Match by prefix supaya nested route (mis. /transmisi/asset/[id]) tetap kena
 * banner. Match prefix terpanjang menang biar `note` paling spesifik dipakai.
 */
export function shouldShowMigrationNotice(pathname: string): MigrationNoticeState {
  if (!pathname) return { show: false };

  const normalized = pathname.replace(/\/+$/, "") || "/";

  let bestMatch: { prefix: string; meta: BqPageMeta } | null = null;

  for (const [prefix, meta] of Object.entries(BQ_PAGES)) {
    const isExact = normalized === prefix;
    const isNested = normalized.startsWith(prefix + "/");
    if (isExact || isNested) {
      if (!bestMatch || prefix.length > bestMatch.prefix.length) {
        bestMatch = { prefix, meta };
      }
    }
  }

  if (!bestMatch) return { show: false };
  return { show: true, note: bestMatch.meta.note };
}
