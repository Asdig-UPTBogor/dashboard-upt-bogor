/**
 * Design tokens — Healthy Index MTU page.
 *
 * Re-exports everything from the shared chart tokens (@/lib/chart-tokens).
 * HI components import from "./design-tokens" — this file keeps those
 * imports working while the source of truth lives in @/lib/chart-tokens.
 */
export {
    getStatusScale,
    STATUS_HI_ORDER,
    PRIORITAS_ORDER,
    USIA_ORDER,
    CRITICALITY_ORDER,
    STATUS_HI_LABEL,
    COLORS,
    ECHART_COLORS,
    ECHART_FONT,
    CHART,
    getTooltipPreset,
    LAYOUT,
    ANIM,
} from "@/lib/chart-tokens";
