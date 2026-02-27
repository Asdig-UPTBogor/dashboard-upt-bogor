import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as turf from '@turf/helpers';
import distance from '@turf/distance';
import pointToLineDistance from '@turf/point-to-line-distance';

interface Tower {
    name: string;
    penghantar: string;
    lat: number;
    lng: number;
}

export function useDistanceCalculator() {
    const [towers, setTowers] = useState<Tower[]>([]);
    const [lines, setLines] = useState<GeoJSON.FeatureCollection | null>(null);
    const fetched = useRef(false);

    useEffect(() => {
        if (fetched.current) return;
        fetched.current = true;

        fetch("/api/towers")
            .then(res => res.json())
            .then(data => {
                const ts: Tower[] = (data.towers || []).filter((t: Tower) => t.lat && t.lng);
                setTowers(ts);

                const getSeq = (name: string) => {
                    const m = name.match(/#(\d+)[A-Za-z]*\s*$/);
                    return m ? parseInt(m[1]) : 0;
                };

                const rawGroups: Record<string, Tower[]> = {};
                for (const t of ts) {
                    const prefix = t.name.replace(/\s*#[\dA-Za-z]+\s*$/, "").trim();
                    if (!prefix) continue;
                    if (!rawGroups[prefix]) rawGroups[prefix] = [];
                    rawGroups[prefix].push(t);
                }

                const features: GeoJSON.Feature[] = [];
                const renderedPrefixes = new Set<string>();

                for (const [sharedPrefix, sharedTowers] of Object.entries(rawGroups)) {
                    const mcMatch = sharedPrefix.match(/^(.+)#(\d+(?:,\d+)+)$/);
                    if (!mcMatch) continue;

                    const basePrefix = mcMatch[1];
                    const circuits = mcMatch[2].split(",").map(s => s.trim());
                    const sortedShared = [...sharedTowers].sort((a, b) => getSeq(a.name) - getSeq(b.name));

                    let maxGap = 0, splitIdx = sortedShared.length - 1;
                    for (let i = 0; i < sortedShared.length - 1; i++) {
                        const gap = getSeq(sortedShared[i + 1].name) - getSeq(sortedShared[i].name);
                        if (gap > maxGap) { maxGap = gap; splitIdx = i; }
                    }
                    const startShared = sortedShared.slice(0, splitIdx + 1);
                    const endShared = maxGap > 1 ? sortedShared.slice(splitIdx + 1) : [];

                    for (const c of circuits) {
                        const circuitPrefix = `${basePrefix}#${c}`;
                        const circuitTowers = rawGroups[circuitPrefix] || [];
                        const sortedCircuit = [...circuitTowers].sort((a, b) => getSeq(a.name) - getSeq(b.name));

                        const fullPath = [...startShared, ...sortedCircuit, ...endShared];
                        if (fullPath.length < 2) continue;

                        features.push(turf.lineString(fullPath.map(t => [t.lng, t.lat]), { penghantar: fullPath[0].penghantar }));
                        renderedPrefixes.add(circuitPrefix);
                    }
                    renderedPrefixes.add(sharedPrefix);
                }

                for (const [prefix, towerList] of Object.entries(rawGroups)) {
                    if (renderedPrefixes.has(prefix)) continue;
                    if (towerList.length < 2) continue;
                    const sorted = [...towerList].sort((a, b) => getSeq(a.name) - getSeq(b.name));
                    features.push(turf.lineString(sorted.map(t => [t.lng, t.lat]), { penghantar: sorted[0].penghantar }));
                }

                setLines(turf.featureCollection(features));
            })
            .catch(console.error);
    }, []);

    const calculateDistance = useCallback((strikeLat: number, strikeLng: number) => {
        if (!towers.length || !lines) return { distTower: 0, distLine: 0 };

        const pt = turf.point([strikeLng, strikeLat]);

        let minDistTower = Infinity;
        for (const t of towers) {
            const d = distance(pt, turf.point([t.lng, t.lat]), { units: 'meters' });
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
