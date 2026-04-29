/**
 * GET /api/data-sources/ss-v5/hierarchy-tree
 * Returns full UPT → ULTG → GI → Bay tree (4-level) dari ss_platform.dim_*.
 * Cached 30 min via bq-cache.
 *
 * ID di-cast STRING karena FARM_FINGERPRINT INT64 > Number.MAX_SAFE_INTEGER.
 */
import { NextResponse } from 'next/server';
import { cachedQuery } from '@/lib/bq-cache';
import { PROJECT, SS_PLATFORM } from '@/lib/ss-v5/sql-generator';

interface TreeRow {
  upt_id: string;
  upt_name: string;
  ultg_id: string;
  ultg_name: string;
  gi_id: string;
  gi_name: string;
  voltage_kv: string | null;
  gi_type: string | null;
  bay_id: string | null;
  bay_name: string | null;
  bay_type: string | null;
  bay_func: string | null;
}

export const revalidate = 60;

export async function GET() {
  try {
    const rows = await cachedQuery<TreeRow[]>(
      'hierarchy-tree-v2',
      'n_Master_Gardu_Induk',
      `
      SELECT
        CAST(u.upt_id AS STRING) AS upt_id,
        u.upt_name,
        CAST(ult.ultg_id AS STRING) AS ultg_id,
        ult.ultg_name,
        CAST(g.gi_id AS STRING) AS gi_id,
        g.gi_name,
        g.voltage_kv,
        g.type AS gi_type,
        CAST(b.bay_id AS STRING) AS bay_id,
        b.bay_name,
        b.bay_type,
        b.bay_func
      FROM \`${PROJECT}.${SS_PLATFORM}.dim_upt\` u
      JOIN \`${PROJECT}.${SS_PLATFORM}.dim_ultg\` ult ON ult.upt_id = u.upt_id AND ult.is_active
      JOIN \`${PROJECT}.${SS_PLATFORM}.dim_gi\` g ON g.ultg_id = ult.ultg_id AND g.is_active
      LEFT JOIN \`${PROJECT}.${SS_PLATFORM}.dim_bay\` b ON b.gi_id = g.gi_id AND b.is_active
      WHERE u.is_active = TRUE
      ORDER BY u.upt_name, ult.ultg_name, g.gi_name, b.bay_name
      `,
    );

    // Transform flat rows → nested 4-level tree (UPT > ULTG > GI > Bay)
    const tree: Record<string, any> = {};
    for (const r of rows) {
      if (!tree[r.upt_id]) {
        tree[r.upt_id] = {
          id: r.upt_id, name: r.upt_name, level: 'upt',
          children: {},
        };
      }
      const upt = tree[r.upt_id];

      if (!upt.children[r.ultg_id]) {
        upt.children[r.ultg_id] = {
          id: r.ultg_id, name: r.ultg_name, level: 'ultg',
          children: {},
        };
      }
      const ultg = upt.children[r.ultg_id];

      if (!ultg.children[r.gi_id]) {
        ultg.children[r.gi_id] = {
          id: r.gi_id, name: r.gi_name, level: 'gi',
          meta: { voltage_kv: r.voltage_kv, gi_type: r.gi_type },
          children: {},
        };
      }
      const gi = ultg.children[r.gi_id];

      // Bay is LEFT JOIN — bisa null kalau GI belum punya Bay
      if (r.bay_id && !gi.children[r.bay_id]) {
        gi.children[r.bay_id] = {
          id: r.bay_id, name: r.bay_name, level: 'bay',
          meta: { bay_type: r.bay_type, bay_func: r.bay_func },
        };
      }
    }

    // Flatten + aggregate stats bottom-up
    function flatten(node: any): any {
      const children = node.children ? Object.values(node.children).map(flatten) : [];
      const stats: any = {};
      if (node.level === 'upt') {
        stats.ultg_count = children.length;
        stats.gi_count = children.reduce((s: number, c: any) => s + (c.stats?.gi_count ?? 0), 0);
        stats.bay_count = children.reduce((s: number, c: any) => s + (c.stats?.bay_count ?? 0), 0);
      } else if (node.level === 'ultg') {
        stats.gi_count = children.length;
        stats.bay_count = children.reduce((s: number, c: any) => s + (c.stats?.bay_count ?? 0), 0);
      } else if (node.level === 'gi') {
        stats.bay_count = children.length;
      }
      return { id: node.id, name: node.name, level: node.level, meta: node.meta, stats, children };
    }

    const result = Object.values(tree).map(flatten);
    return NextResponse.json({ tree: result, totalUpt: result.length });
  } catch (e: any) {
    console.error('[hierarchy-tree] Error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
