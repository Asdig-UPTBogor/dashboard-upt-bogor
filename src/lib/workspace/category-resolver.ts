/**
 * category-resolver — pure fn: dataset id → category key string.
 *
 *  3-tier fallback:
 *    1. FS overlay    (admin set via UI)
 *    2. BQ label      (seed layer, via `bq update --set_label`)
 *    3. Convention    (rule-based pure fn, never fails)
 *
 *  Return `string` (bukan `CategoryKey`) — kategori custom dari FS juga valid.
 *  Orphan handling: caller (DatasetTree) cek apakah kategori ada di registry.
 *  Kalau kategori di-archive, caller fallback ke "uncategory" sendiri.
 */

import { UNCATEGORY_KEY, type CategoryKey } from "@/app/data-workspace/_components/workspace-tokens";

interface Rule {
    test: (id: string) => boolean;
    category: CategoryKey;
}

/** Urutan matters — rule pertama yang match menang. Lebih spesifik dulu. */
const RULES: Rule[] = [
    { test: (id) => /transmisi|transmission|tower|row/i.test(id), category: "transmission" },
    { test: (id) => /gardu.?induk|^dashboard_gardu/i.test(id), category: "gardu-induk" },
    { test: (id) => /proteks|protection|relay|hargi_?proteksi|common_enemy/i.test(id), category: "protection" },
    { test: (id) => /^(thor|dispatch|wagate|notifier|waha|heimdall|asisten|platform_internal)/i.test(id), category: "platform" },
];

export function categoryFromConvention(datasetId: string): CategoryKey {
    for (const r of RULES) {
        if (r.test(datasetId)) return r.category;
    }
    return UNCATEGORY_KEY;
}

/**
 * resolveCategory — 3-tier. Honor FS/BQ value apa adanya (kategori custom valid).
 * Caller validasi terhadap registry aktif untuk orphan handling.
 */
export function resolveCategory(
    datasetId: string,
    opts: { fsCategory?: string | null; bqLabel?: string | null } = {},
): string {
    const candidate = opts.fsCategory ?? opts.bqLabel;
    if (candidate && candidate.trim()) return candidate;
    return categoryFromConvention(datasetId);
}
