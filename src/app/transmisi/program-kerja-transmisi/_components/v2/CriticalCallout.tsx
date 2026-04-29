import { Icon } from "@/components/designer/Icon";

interface CriticalCalloutProps {
  belumMulai: number;
  tertunda: number;
  itemTertinggal?: number;
  catatan?: string;
}

export function CriticalCallout({ belumMulai, tertunda, itemTertinggal, catatan }: CriticalCalloutProps) {
  return (
    <div
      style={{
        gridColumn: "span 12",
        background:
          "linear-gradient(135deg, color-mix(in oklab, var(--cond-critical) 8%, var(--bg-1)) 0%, var(--bg-1) 60%)",
        border: "1px solid color-mix(in oklab, var(--cond-critical) 30%, var(--line))",
        borderRadius: "var(--r-lg)",
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        gap: 20,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: "color-mix(in oklab, var(--cond-critical) 18%, transparent)",
          color: "var(--cond-critical)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon name="alert" size={18} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-0)", marginBottom: 2 }}>
          <span className="num">{belumMulai}</span> program belum dimulai ·{" "}
          <span className="num">{tertunda}</span> program tertunda — perlu tindakan segera
        </div>
        <div style={{ fontSize: 12, color: "var(--fg-1)" }}>
          {catatan ?? `Pastikan target item per ULTG sudah didistribusikan${itemTertinggal != null ? ` · ${itemTertinggal.toLocaleString("id-ID")} item belum tercapai` : ""}.`}
        </div>
      </div>

    </div>
  );
}
