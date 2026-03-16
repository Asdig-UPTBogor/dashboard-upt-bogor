/**
 * buildConductorLines — Shared utility to build GeoJSON LineString features
 * from tower data, grouping by PENGHANTAR and handling multi-circuit lines.
 *
 * Used by:
 *   - useConductorLines (map rendering)
 *   - useStrikeOverlay (nearest-point-on-line)
 *   - useDistanceCalculator (distance calculation)
 *
 * @module buildConductorLines
 */

import { lineString, featureCollection } from "@turf/helpers";

export interface ConductorTower {
    name: string;
    penghantar: string;
    lat: number;
    lng: number;
}

/** Extract trailing #NNN sequence number from tower name */
function getSeq(name: string): number {
    const m = name.match(/#(\d+)[A-Za-z]*\s*$/);
    return m ? parseInt(m[1]) : 0;
}

/**
 * Build GeoJSON FeatureCollection of LineStrings connecting towers
 * along their transmission lines (grouped by PENGHANTAR prefix).
 *
 * Handles multi-circuit shared segments: e.g. "SGLNG-CIBN7#1,2"
 * splits into individual circuits and merges with shared tower segments.
 */
export function buildConductorLines(towers: ConductorTower[]): GeoJSON.FeatureCollection {
    const filtered = towers.filter(t => t.penghantar);

    // Group towers by name prefix (strip trailing #NNN)
    const rawGroups: Record<string, ConductorTower[]> = {};
    for (const t of filtered) {
        const prefix = t.name.replace(/\s*#[\dA-Za-z]+\s*$/, "").trim();
        if (!prefix) continue;
        if (!rawGroups[prefix]) rawGroups[prefix] = [];
        rawGroups[prefix].push(t);
    }

    const features: GeoJSON.Feature[] = [];
    const renderedPrefixes = new Set<string>();

    // Step 1: Multi-circuit groups (e.g. "SGLNG-CIBN7#1,2")
    for (const [sharedPrefix, sharedTowers] of Object.entries(rawGroups)) {
        const mcMatch = sharedPrefix.match(/^(.+)#(\d+(?:,\d+)+)$/);
        if (!mcMatch) continue;

        const basePrefix = mcMatch[1];
        const circuits = mcMatch[2].split(",").map(s => s.trim());

        const sortedShared = [...sharedTowers].sort((a, b) => getSeq(a.name) - getSeq(b.name));

        // Find the largest sequential gap → split start-shared vs end-shared
        let maxGap = 0, splitIdx = sortedShared.length - 1;
        for (let i = 0; i < sortedShared.length - 1; i++) {
            const gap = getSeq(sortedShared[i + 1].name) - getSeq(sortedShared[i].name);
            if (gap > maxGap) { maxGap = gap; splitIdx = i; }
        }
        const startShared = sortedShared.slice(0, splitIdx + 1);
        const endShared = maxGap > 1 ? sortedShared.slice(splitIdx + 1) : [];

        // Build one complete line per circuit
        for (const c of circuits) {
            const circuitPrefix = `${basePrefix}#${c}`;
            const circuitTowers = rawGroups[circuitPrefix] || [];
            const sortedCircuit = [...circuitTowers].sort((a, b) => getSeq(a.name) - getSeq(b.name));

            const fullPath = [...startShared, ...sortedCircuit, ...endShared];
            if (fullPath.length < 2) continue;

            const penghantar = fullPath[0].penghantar;
            features.push(
                lineString(
                    fullPath.map(t => [t.lng, t.lat]),
                    { penghantar, towerCount: fullPath.length }
                )
            );
            renderedPrefixes.add(circuitPrefix);
        }
        renderedPrefixes.add(sharedPrefix);
    }

    // Step 2: Remaining groups (not part of any multi-circuit)
    for (const [prefix, towerList] of Object.entries(rawGroups)) {
        if (renderedPrefixes.has(prefix)) continue;
        if (towerList.length < 2) continue;

        const sorted = [...towerList].sort((a, b) => getSeq(a.name) - getSeq(b.name));
        const penghantar = sorted[0].penghantar;
        features.push(
            lineString(
                sorted.map(t => [t.lng, t.lat]),
                { penghantar, towerCount: sorted.length }
            )
        );
    }

    return featureCollection(features);
}
