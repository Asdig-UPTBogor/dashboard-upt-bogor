import { useState, useEffect, useCallback, useMemo } from 'react';
import { point } from '@turf/helpers';
import distance from '@turf/distance';
import pointToLineDistance from '@turf/point-to-line-distance';
import type { Tower as FullTower } from '@/types/asset-maps-types';
import { buildConductorLines } from '@/lib/buildConductorLines';

interface Tower {
    name: string;
    penghantar: string;
    lat: number;
    lng: number;
}

export function useDistanceCalculator(allTowers: FullTower[]) {
    const [towers, setTowers] = useState<Tower[]>([]);
    const [lines, setLines] = useState<GeoJSON.FeatureCollection | null>(null);

    useEffect(() => {
        if (allTowers.length === 0) return;

        const ts: Tower[] = allTowers.map(t => ({
            name: t.name, penghantar: t.penghantar, lat: t.lat, lng: t.lng
        }));
        setTowers(ts);

        // Build conductor lines using shared utility
        const conductorLines = buildConductorLines(
            ts.filter(t => t.penghantar)
        );
        setLines(conductorLines);
    }, [allTowers]);

    const calculateDistance = useCallback((strikeLat: number, strikeLng: number) => {
        if (!towers.length || !lines) return { distTower: 0, distLine: 0 };

        const pt = point([strikeLng, strikeLat]);

        let minDistTower = Infinity;
        for (const t of towers) {
            const d = distance(pt, point([t.lng, t.lat]), { units: 'meters' });
            if (d < minDistTower) minDistTower = d;
        }

        let minDistLine = Infinity;
        for (const f of lines.features) {
            const d = pointToLineDistance(pt, f as any, { units: 'meters' });
            if (d < minDistLine) minDistLine = d;
        }

        return {
            distTower: minDistTower === Infinity ? 0 : Math.round(minDistTower),
            distLine: minDistLine === Infinity ? 0 : Math.round(minDistLine)
        };
    }, [towers, lines]);

    const isReady = useMemo(() => towers.length > 0 && lines !== null, [towers, lines]);

    return { calculateDistance, isReady };
}
