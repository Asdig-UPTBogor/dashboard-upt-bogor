/* eslint-disable @next/next/no-img-element */
/**
 * Infografis Pemasangan WAP — UPT Bogor (full-bleed, light).
 * Komposisi mengikuti referensi: header logo · 3 stat block · footer value + QR.
 * Identitas dashboard (token light) + background trafo. Route bypass sidebar (LayoutChrome).
 * Data hardcoded (rekap manual WAP Trafo 20kV).
 */

const T = {
  bg: "#f6f7f9", panel: "#ffffff", line: "#e6e9ef", line2: "#eef1f4",
  fg: "#0e1319", fg2: "#5a6472", fg3: "#8a91a0",
  blue: "#3f6fd8", emerald: "#1f9d55", emeraldBr: "#3ecf8e",
  amber: "#bf8e1e", orange: "#e0772f", red: "#dc2f34",
};

const PCT = 91.5;
const R = 52;
const CIRC = 2 * Math.PI * R;

function Donut() {
  return (
    <div style={{ position: "relative", width: 150, height: 150, flexShrink: 0 }}>
      <svg width="150" height="150" viewBox="0 0 150 150">
        <circle cx="75" cy="75" r={R} fill="none" stroke="#e6e9ef" strokeWidth="15" />
        <circle
          cx="75" cy="75" r={R} fill="none" stroke="url(#wg)" strokeWidth="15" strokeLinecap="round"
          transform="rotate(-90 75 75)"
          strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - PCT / 100)}
        />
        <defs>
          <linearGradient id="wg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={T.emerald} />
            <stop offset="1" stopColor={T.emeraldBr} />
          </linearGradient>
        </defs>
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <b className="wnum" style={{ fontSize: 38, fontWeight: 800, color: T.emerald, letterSpacing: "-0.02em", lineHeight: 1 }}>91,5%</b>
        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.18em", color: T.fg2, textTransform: "uppercase", marginTop: 4 }}>Capaian</span>
      </div>
    </div>
  );
}

function StatCard({ accent, accent2, icon, label, value, sub, valueColor }: {
  accent: string; accent2: string; icon: React.ReactNode; label: string; value: string; sub: string; valueColor: string;
}) {
  return (
    <div style={{
      flex: 1, background: "rgba(255,255,255,0.82)", border: `1px solid ${T.line}`, borderRadius: 16,
      padding: "20px 22px", position: "relative", overflow: "hidden",
      boxShadow: "0 14px 34px rgba(16,24,40,0.10), inset 0 1px 0 rgba(255,255,255,0.9)", backdropFilter: "blur(14px)",
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${accent}, ${accent2})` }} />
      <div style={{ width: 50, height: 50, borderRadius: 13, display: "grid", placeItems: "center", background: `${accent}1f`, color: accent, marginBottom: 14 }}>{icon}</div>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", color: T.fg2, textTransform: "uppercase", lineHeight: 1.3 }}>{label}</div>
      <div className="wnum" style={{ fontSize: 62, fontWeight: 800, lineHeight: 0.9, marginTop: 8, letterSpacing: "-0.02em", color: valueColor }}>{value}</div>
      <div style={{ marginTop: 12, fontSize: 11.5, fontWeight: 600, color: T.fg3 }}>{sub}</div>
    </div>
  );
}

function UltgBar({ name, done, total, pct }: { name: string; done: number; total: number; pct: number }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ fontSize: 12.5, fontWeight: 800, color: T.fg }}>{name}</span>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: T.fg2 }}>
          <b className="wnum" style={{ color: T.emerald, fontWeight: 800 }}>{done}</b>/{total} · {pct}%
        </span>
      </div>
      <div style={{ height: 9, background: "#e6e9ef", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 99, background: `linear-gradient(90deg, ${T.emerald}, ${T.emeraldBr})` }} />
      </div>
    </div>
  );
}

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@600;700;800&display=swap');
.wstage{font-family:'Inter',-apple-system,sans-serif;-webkit-font-smoothing:antialiased}
.wnum{font-family:'JetBrains Mono',monospace;font-variant-numeric:tabular-nums}`;

export default function WapInfografisPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#e9ebef", display: "grid", placeItems: "center" }}>
      <style>{FONT_IMPORT}</style>
      <div className="wstage" style={{ width: 1280, height: 720, background: T.bg, color: T.fg, position: "relative", overflow: "hidden" }}>

        {/* background trafo + light blends */}
        <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: "56%", background: "url('/wap/bg-trafo.png') center 30% / cover no-repeat" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(100deg, #f6f7f9 0%, #f6f7f9 37%, rgba(246,247,249,0.88) 49%, rgba(246,247,249,0.28) 70%, rgba(246,247,249,0.5) 100%)" }} />
        <div style={{ position: "absolute", top: -180, right: -100, width: 520, height: 520, borderRadius: "50%", background: "radial-gradient(circle, rgba(62,207,142,0.16), transparent 65%)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, #f6f7f9 0%, #f6f7f9 9%, transparent 22%)" }} />

        <div style={{ position: "absolute", inset: 0, zIndex: 4, display: "flex", flexDirection: "column", padding: "28px 40px 22px" }}>

          {/* HEADER */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <img src="/wap/logo-danantara.png" alt="Danantara" style={{ height: 32 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", color: T.fg3, textAlign: "right", lineHeight: 1.45, textTransform: "uppercase" }}>
                UIT JBT<br /><b style={{ color: T.fg, fontWeight: 800 }}>UPT BOGOR</b>
              </span>
              <img src="/wap/logo-pln.png" alt="PLN" style={{ height: 54 }} />
            </div>
          </div>

          {/* TITLE */}
          <div style={{ marginTop: 18, maxWidth: 800 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 10.5, fontWeight: 800, letterSpacing: "0.22em", color: T.emerald, textTransform: "uppercase" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.emeraldBr, boxShadow: `0 0 8px ${T.emeraldBr}` }} />
              Infografis Pemasangan WAP
              <span style={{ width: 34, height: 1, background: `linear-gradient(90deg, ${T.emerald}, transparent)` }} />
            </span>
            <h1 style={{ fontSize: 40, fontWeight: 900, letterSpacing: "-0.025em", lineHeight: 1.02, margin: "11px 0 0", color: T.fg }}>
              PEMASANGAN WAP <span style={{ color: T.emerald }}>UPT BOGOR</span>
            </h1>
            <div style={{ marginTop: 8, fontSize: 13.5, color: T.fg2, fontWeight: 500 }}>
              Realisasi pemasangan <b style={{ color: T.fg, fontWeight: 700 }}>Sungkup Bushing</b> Trafo 20kV · Ringkasan Keseluruhan
            </div>
          </div>

          {/* 3 STAT BLOCKS */}
          <div style={{ display: "flex", gap: 16, marginTop: 22 }}>
            <StatCard
              accent={T.blue} accent2="#7aa6f5" valueColor={T.blue} label={"Total Target"} value="47"
              sub="Trafo 20kV · Bogor 36 + Sukabumi 11"
              icon={<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="9" width="14" height="11" rx="1.5" /><path d="M8 9V6.5a4 4 0 0 1 8 0V9" /><path d="M3 13h2M3 16h2M19 13h2M19 16h2" /><circle cx="12" cy="14.5" r="2" /></svg>}
            />
            <StatCard
              accent={T.emerald} accent2={T.emeraldBr} valueColor={T.emerald} label={"Total Realisasi"} value="43"
              sub="Sungkup Bushing terpasang · 2026"
              icon={<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
            />
            <div style={{
              flex: 1.25, display: "flex", alignItems: "center", gap: 20, minWidth: 280,
              background: "rgba(255,255,255,0.82)", border: `1px solid ${T.line}`, borderRadius: 16, padding: "16px 20px",
              position: "relative", overflow: "hidden", boxShadow: "0 14px 34px rgba(16,24,40,0.10), inset 0 1px 0 rgba(255,255,255,0.9)", backdropFilter: "blur(14px)",
            }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${T.emerald}, ${T.amber})` }} />
              <Donut />
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", color: T.fg2, textTransform: "uppercase", marginBottom: 12 }}>Persentase<br />Total</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600, color: T.fg2, marginTop: 6 }}>
                  <span style={{ width: 11, height: 11, borderRadius: 3, background: T.emerald }} />Terpasang <b style={{ color: T.fg }}>43 / 47</b>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600, color: T.fg2, marginTop: 6 }}>
                  <span style={{ width: 11, height: 11, borderRadius: 3, background: "#d4d9e0" }} />Belum <b style={{ color: T.fg }}>4 unit</b>
                </div>
              </div>
            </div>
          </div>

          {/* PER ULTG + INSIGHT */}
          <div style={{ display: "flex", gap: 16, marginTop: 16, alignItems: "stretch" }}>
            <div style={{ flex: 1.6, display: "flex", gap: 22, background: "rgba(255,255,255,0.78)", border: `1px solid ${T.line}`, borderRadius: 14, padding: "13px 18px", boxShadow: "0 6px 18px rgba(16,24,40,0.06)" }}>
              <UltgBar name="ULTG Bogor" done={32} total={36} pct={89} />
              <div style={{ width: 1, background: T.line }} />
              <UltgBar name="ULTG Sukabumi" done={11} total={11} pct={100} />
            </div>
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, background: "rgba(191,142,30,0.12)", border: "1px solid rgba(191,142,30,0.35)", borderRadius: 14, padding: "13px 16px" }}>
              <span style={{ width: 20, height: 20, borderRadius: "50%", background: T.amber, color: "#fff", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 900, flexShrink: 0 }}>i</span>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: "#7a5c12", lineHeight: 1.35 }}><b style={{ color: "#5c4609", fontWeight: 800 }}>TRF#4 Lembursitu</b> — unit yang terpasang Corbuzier</span>
            </div>
          </div>

          {/* FOOTER: nilai + QR */}
          <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 14, borderTop: `1px solid ${T.line}` }}>
            <div style={{ display: "flex", gap: 22 }}>
              {[
                { c: T.blue, l: "AMAN", s: "Lindungi sistem" },
                { c: T.emerald, l: "ANDAL", s: "Kurangi gangguan" },
                { c: T.amber, l: "EFISIEN", s: "Operasi optimal" },
                { c: T.orange, l: "BERKELANJUTAN", s: "Lingkungan baik" },
              ].map((v) => (
                <div key={v.l} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span style={{ width: 28, height: 28, borderRadius: 8, background: v.c, boxShadow: "0 3px 8px rgba(16,24,40,0.12)" }} />
                  <div style={{ lineHeight: 1.2 }}>
                    <b style={{ display: "block", fontSize: 11, fontWeight: 800, letterSpacing: "0.04em", color: T.fg }}>{v.l}</b>
                    <span style={{ fontSize: 9, color: T.fg3, fontWeight: 600 }}>{v.s}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ textAlign: "right", lineHeight: 1.3 }}>
                <span style={{ display: "block", fontSize: 13, fontWeight: 900, letterSpacing: "0.02em", color: T.emerald }}># Powering The Future</span>
                <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "0.14em", color: T.fg3 }}>REKAP REALISASI WAP · 2026</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
