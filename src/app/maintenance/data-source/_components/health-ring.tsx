"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

/**
 * HealthRing — ECharts gauge chart for overall system health.
 *
 * Uses Apache ECharts (echarts-for-react) for consistency with the rest
 * of the dashboard. Dynamic import with SSR disabled.
 */
const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

export function HealthRing({ score, size = 120 }: { score: number; size?: number }) {
    const color = score >= 90 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";
    const bgColor = score >= 90 ? "rgba(16,185,129,0.08)" : score >= 60 ? "rgba(245,158,11,0.08)" : "rgba(239,68,68,0.08)";

    const option = useMemo(() => ({
        backgroundColor: "transparent",
        series: [
            {
                type: "gauge",
                startAngle: 225,
                endAngle: -45,
                radius: "90%",
                center: ["50%", "50%"],
                min: 0,
                max: 100,
                pointer: { show: false },
                axisTick: { show: false },
                axisLabel: { show: false },
                splitLine: { show: false },
                axisLine: {
                    lineStyle: {
                        width: 10,
                        color: [
                            [score / 100, color],
                            [1, "rgba(255,255,255,0.04)"],
                        ],
                        cap: "round",
                    },
                },
                detail: {
                    valueAnimation: true,
                    formatter: `{value}%`,
                    fontSize: size * 0.22,
                    fontWeight: 700,
                    fontFamily: "ui-sans-serif, system-ui, sans-serif",
                    color: "#ffffff",
                    offsetCenter: [0, "0%"],
                },
                data: [{ value: score }],
            },
        ],
    }), [score, color, size]);

    return (
        <div
            className="relative rounded-full"
            style={{ width: size, height: size, background: bgColor }}
        >
            <ReactECharts
                option={option}
                style={{ width: size, height: size }}
                opts={{ renderer: "svg" }}
            />
        </div>
    );
}
