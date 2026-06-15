import { ImageResponse } from "next/og";
import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROOT = process.cwd();
const ASSET = path.join(ROOT, "public/wap/poster/assets");
const FONT = path.join(ROOT, "src/app/api/og/_fonts");
// Asset + font dibaca sekali per instance, bukan per request
const uriCache = new Map<string, string>();
const uri = (f: string) => {
  let v = uriCache.get(f);
  if (!v) { v = `data:image/png;base64,${fs.readFileSync(path.join(ASSET, f)).toString("base64")}`; uriCache.set(f, v); }
  return v;
};
const fontCache = new Map<string, Buffer>();
const font = (f: string) => {
  let v = fontCache.get(f);
  if (!v) { v = fs.readFileSync(path.join(FONT, f)); fontCache.set(f, v); }
  return v;
};

type Tok = Record<string, string>;
const DARK: Tok = {
  fg0: "#eef1f6", fg1: "#aab2c0", fg2: "#727b8b", fg3: "#5a6273",
  line: "rgba(255,255,255,.10)", line2: "rgba(255,255,255,.16)", card: "rgba(17,21,28,.55)",
  base: "#06080b", ok: "#3ecf8e", warn: "#f3c14b", bad: "#f08a3e",
  brand: "#f3c14b", orange: "#f0852e", blue: "#5b8def", green: "#3ecf8e",
};
const LIGHT: Tok = {
  fg0: "#1a2230", fg1: "#475063", fg2: "#7a8493", fg3: "#aeb6c2",
  line: "rgba(15,23,42,.10)", line2: "rgba(15,23,42,.16)", card: "rgba(255,255,255,.82)",
  base: "#eef1f5", ok: "#0e9f6e", warn: "#c98a16", bad: "#dd6b20",
  brand: "#c98a16", orange: "#e0681a", blue: "#2f6fde", green: "#0e9f6e",
};
let C: Tok = DARK;

// ====== DATA (statik dulu; nanti diganti query Postgres) ======
const DATA = {
  tag: "PLN · UPT Bogor", date: "10 Juni 2026", title: ["PROGRESS PEMASANGAN", "WAP"], badge: "UPT BOGOR",
  sub: "Instalasi WAP pada Transformator 20 kV untuk sistem kelistrikan yang lebih andal.",
  summary: { caption: "Progress Pemasangan WAP", accent: "orange", total: 47, terpasang: 43 },
  ultg: [
    { nama: "ULTG Bogor", accent: "blue", total: 36, terpasang: 32 },
    { nama: "ULTG Sukabumi", accent: "green", total: 11, terpasang: 11 },
  ],
  notes: [
    { tone: "bad", gi: "GI 150kV Sentul", text: "Trafo 3, 4, 5 & Trafo Mobile belum terpasang." },
    { tone: "ok", gi: "GI 150kV Lembursitu", text: "Trafo 4 telah terpasang; jenis WAP Corbuzier." },
  ],
  footer: {
    hierarchy: [["UIT JBT", "brand"], ["UPT Bogor", "fg0"], ["ULTG Bogor", "blue"], ["ULTG Sukabumi", "green"]] as [string, string][],
    tagline: "Energi untuk negeri, terang untuk masa depan.",
  },
};
const col = (n: string) => C[n] || n;

const pct = (a: number, b: number) => (b ? (a / b) * 100 : 0);
const fmtPct = (p: number) => (Math.round(p * 10) / 10 % 1 === 0 ? Math.round(p) + "%" : (Math.round(p * 10) / 10).toString().replace(".", ",") + "%");
// Warna semantik dihitung dari nilai yang DITAMPILKAN (1 desimal) — biar 84,95%
// yang ke-display "85%" dapet warna hijau, bukan amber (anti mismatch angka vs warna)
const sem = (p: number) => { const r = Math.round(p * 10) / 10; return r >= 85 ? C.ok : r >= 60 ? C.warn : C.bad; };

const F = (s: React.CSSProperties): React.CSSProperties => ({ display: "flex", ...s });

// Lucide icons (dipakai shadcn) — path-only biar Satori-safe (no polyline/polygon/rect/circle)
const ICONS: Record<string, string[]> = {
  trend: ["M22 7L13.5 15.5L8.5 10.5L2 17", "M16 7L22 7L22 13"],
  pin: ["M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z", "M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0"],
  clip: ["M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2", "M9 2h6a1 1 0 0 1 1 1v2H8V3a1 1 0 0 1 1-1z", "M9 12h6", "M9 16h6"],
  shield: ["M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z", "M9 12l2 2 4-4"],
  zap: ["M13 2L3 14h9l-1 8 10-12h-9l1-8z"],
  gauge: ["M12 14l4-4", "M3.34 19a10 10 0 1 1 17.32 0"],
  leaf: ["M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z", "M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"],
};
function Icon({ name, color, size = 18 }: { name: string; color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" style={{ display: "flex" }}>
      {(ICONS[name] || []).map((d, i) => <path key={i} d={d} />)}
    </svg>
  );
}
function Caption({ txt, color, icon }: { txt: string; color: string; icon: string }) {
  return (
    <div style={F({ alignItems: "center" })}>
      <Icon name={icon} color={color} size={19} />
      <div style={F({ marginLeft: 10, fontSize: 17, color, letterSpacing: 0.2, fontWeight: 700 })}>{txt}</div>
    </div>
  );
}
function Stat({ lab, val, unit, vc, sz }: { lab: string; val: string; unit: string; vc?: string; sz: number }) {
  return (
    <div style={F({ flex: 1, flexDirection: "column", alignItems: "center", padding: "0 18px" })}>
      <div style={F({ fontSize: 12, color: C.fg2, fontWeight: 600, letterSpacing: 1.1 })}>{lab.toUpperCase()}</div>
      <div style={F({ fontSize: sz, color: vc || C.fg0, fontWeight: 700, fontFamily: "JBM", marginTop: 7, letterSpacing: -2 })}>{val}</div>
      <div style={F({ fontSize: 12, color: C.fg2, marginTop: 7 })}>{unit}</div>
    </div>
  );
}
const VD = () => <div style={{ width: 1, alignSelf: "stretch", background: C.line, margin: "4px 0" }} />;

function Bar({ p }: { p: number }) {
  const open = Math.max(100 - p, 0);
  return (
    <div style={F({ width: "100%", height: 12 })}>
      <div style={{ width: `${p}%`, height: 12, background: C.ok, borderRadius: open <= 0.5 ? 6 : "6px 0 0 6px" }} />
      {open > 0.5 && <div style={{ width: `${open}%`, height: 12, background: C.bad, borderRadius: "0 6px 6px 0", marginLeft: 4 }} />}
    </div>
  );
}
function Legend({ terpasang, sisa }: { terpasang: number; sisa: number }) {
  return (
    <div style={F({})}>
      <div style={F({ alignItems: "center" })}>
        <div style={{ width: 9, height: 9, borderRadius: 3, background: C.ok }} />
        <div style={F({ marginLeft: 7, fontSize: 12.5, color: C.fg2 })}>Terpasang</div>
        <div style={F({ marginLeft: 6, fontSize: 12.5, color: C.ok, fontWeight: 700, fontFamily: "JBM" })}>{terpasang}</div>
      </div>
      {sisa > 0 && (
        <div style={F({ alignItems: "center", marginLeft: 22 })}>
          <div style={{ width: 9, height: 9, borderRadius: 3, background: C.bad }} />
          <div style={F({ marginLeft: 7, fontSize: 12.5, color: C.fg2 })}>On Progress</div>
          <div style={F({ marginLeft: 6, fontSize: 12.5, color: C.bad, fontWeight: 700, fontFamily: "JBM" })}>{sisa}</div>
        </div>
      )}
    </div>
  );
}
function Kpi({ caption, accent, total, terpasang, small, icon }: { caption: string; accent: string; total: number; terpasang: number; small?: boolean; icon: string }) {
  const p = pct(terpasang, total), sisa = Math.max(total - terpasang, 0), sz = small ? 36 : 50;
  return (
    <div style={F({ flexDirection: "column", background: C.card, border: `1px solid ${C.line}`, borderRadius: 20, padding: small ? "16px 28px" : "20px 32px", gap: small ? 12 : 16, boxShadow: "0 12px 30px rgba(0,0,0,.28)" })}>
      <Caption txt={caption} color={accent} icon={icon} />
      <div style={F({ alignItems: "center" })}>
        <Stat lab="Target" val={String(total)} unit="Unit Trafo" sz={sz} />
        <VD /><Stat lab="Terpasang" val={String(terpasang)} unit="Unit Trafo" vc={C.ok} sz={sz} />
        <VD /><Stat lab="Selesai" val={fmtPct(p)} unit="Terpasang" vc={sem(p)} sz={sz} />
      </div>
      <div style={F({ flexDirection: "column", gap: 11 })}><Bar p={p} /><Legend terpasang={terpasang} sisa={sisa} /></div>
    </div>
  );
}

const PILL: [string, string, string][] = [
  ["shield", "AMAN", "Lindungi sistem & infrastruktur"],
  ["zap", "ANDAL", "Kurangi gangguan, keandalan naik"],
  ["gauge", "EFISIEN", "Pemasangan tepat guna & optimal"],
  ["leaf", "BERKELANJUTAN", "Lingkungan yang lebih baik"],
];
function Pillar({ p }: { p: [string, string, string] }) {
  return (
    <div style={F({ flex: 1, flexDirection: "column", alignItems: "center", background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "14px 12px" })}>
      <Icon name={p[0]} color={C.brand} size={24} />
      <div style={F({ fontSize: 12.5, color: C.fg0, fontWeight: 700, marginTop: 9, letterSpacing: 0.6 })}>{p[1]}</div>
      <div style={F({ fontSize: 10, color: C.fg2, marginTop: 5, textAlign: "center" })}>{p[2]}</div>
    </div>
  );
}

// Komponen baca token via module-global `C` — render WAJIB diserialisasi supaya
// request dark/light yang concurrent ga saling timpa tema di tengah render Satori.
// PNG di-buffer penuh di dalam lock sebelum lock dilepas.
let renderLock: Promise<unknown> = Promise.resolve();

export async function GET(req: Request) {
  const job = renderLock.then(() => render(req));
  renderLock = job.then(() => undefined, () => undefined);
  return job;
}

async function render(req: Request): Promise<Response> {
  const isLight = new URL(req.url).searchParams.get("t") === "light";
  C = isLight ? LIGHT : DARK;
  const d = DATA;
  const bgImg = isLight ? "bg-gi-light.png" : "bg-gi-dark.png";
  const danLogo = isLight ? "logo-danantara.png" : "logo-danantara-w.png";
  const plnLogo = isLight ? "logo-pln.png" : "logo-pln-w.png";
  const overlay = isLight
    ? "linear-gradient(180deg, rgba(244,247,250,.55) 0%, rgba(244,247,250,.3) 18%, rgba(244,247,250,.6) 40%, rgba(244,247,250,.85) 60%, rgba(244,247,250,.96) 100%)"
    : "linear-gradient(180deg, rgba(6,8,11,.62) 0%, rgba(6,8,11,.34) 16%, rgba(6,8,11,.55) 38%, rgba(6,8,11,.74) 60%, rgba(6,8,11,.9) 100%)";
  const tree = (
    <div style={F({ position: "relative", width: 1024, height: 1536, background: C.base, fontFamily: "Inter" })}>
      <img src={uri(bgImg)} style={{ position: "absolute", top: 0, left: 0, width: 1024, height: 1536, objectFit: "cover" }} />
      <div style={{ position: "absolute", top: 0, left: 0, width: 1024, height: 1536, backgroundImage: overlay }} />
      <div style={F({ flexDirection: "column", width: 1024, height: 1536, padding: "46px 52px 40px" })}>
        <div style={F({ justifyContent: "space-between", alignItems: "center", paddingBottom: 20, borderBottom: `1px solid ${C.line}` })}>
          <img src={uri(danLogo)} style={{ height: 36 }} />
          <img src={uri(plnLogo)} style={{ height: 72 }} />
        </div>
        <div style={F({ flex: 1, flexDirection: "column", justifyContent: "space-between", gap: 14, paddingTop: 16 })}>
          <div style={F({ flexDirection: "column" })}>
            <div style={F({ justifyContent: "space-between", alignItems: "center" })}>
              <div style={F({ alignItems: "center" })}>
                <div style={{ width: 26, height: 1, background: C.brand }} />
                <div style={F({ marginLeft: 9, fontSize: 12, color: C.fg1, fontWeight: 600, letterSpacing: 2.4 })}>{d.tag.toUpperCase()}</div>
              </div>
              <div style={F({ alignItems: "center" })}>
                <div style={{ width: 7, height: 7, borderRadius: 4, background: C.ok }} />
                <div style={F({ marginLeft: 9, fontSize: 12.5, color: C.fg2, fontWeight: 500 })}>{d.date}</div>
              </div>
            </div>
            <div style={F({ marginTop: 12, gap: 18 })}>
              <div style={F({ fontSize: 52, fontWeight: 800, color: C.fg0, letterSpacing: -2 })}>{d.title[0]}</div>
              <div style={F({ fontSize: 52, fontWeight: 800, color: C.brand, letterSpacing: -2 })}>{d.title[1]}</div>
            </div>
            <div style={F({ marginTop: 12, alignSelf: "flex-start", border: `1px solid ${C.line2}`, background: isLight ? "rgba(255,255,255,.6)" : "rgba(255,255,255,.05)", padding: "8px 17px", borderRadius: 9 })}>
              <div style={F({ fontSize: 14, color: C.fg0, fontWeight: 600, letterSpacing: 1.6 })}>{d.badge}</div>
            </div>
            <div style={F({ marginTop: 12, fontSize: 15, color: C.fg1, maxWidth: 580, lineHeight: 1.5 })}>{d.sub}</div>
          </div>
          <Kpi caption={d.summary.caption} accent={col(d.summary.accent)} total={d.summary.total} terpasang={d.summary.terpasang} icon="trend" />
          {d.ultg.map((u, i) => <Kpi key={i} caption={u.nama} accent={col(u.accent)} total={u.total} terpasang={u.terpasang} small icon="pin" />)}
          <div style={F({ flexDirection: "column", background: C.card, border: `1px solid ${C.line}`, borderRadius: 20, padding: "14px 26px", gap: 8 })}>
            <Icon name="clip" color={C.orange} size={22} />
            {d.notes.map((n, i) => (
              <div key={i} style={F({ alignItems: "flex-start" })}>
                <div style={{ width: 7, height: 7, borderRadius: 4, background: col(n.tone), marginTop: 6 }} />
                <div style={F({ marginLeft: 11, fontSize: 12.5, color: C.fg1, lineHeight: 1.45, flex: 1 })}>
                  <span style={{ color: C.fg0, fontWeight: 700 }}>{n.gi}</span>&nbsp;— {n.text}
                </div>
              </div>
            ))}
          </div>
          <div style={F({ gap: 12 })}>
            {PILL.map((p, i) => <Pillar key={i} p={p} />)}
          </div>
        </div>
        <div style={F({ justifyContent: "space-between", alignItems: "center", paddingTop: 18, marginTop: 6, borderTop: `1px solid ${C.line2}` })}>
          <div style={F({ alignItems: "center" })}>
            {d.footer.hierarchy.map(([t, c], i) => (
              <div key={i} style={F({ alignItems: "center" })}>
                <div style={F({ fontSize: 14, color: col(c), fontWeight: 700 })}>{t}</div>
                {i < d.footer.hierarchy.length - 1 && <div style={F({ fontSize: 14, color: C.fg3, margin: "0 10px" })}>·</div>}
              </div>
            ))}
          </div>
          <div style={F({ fontSize: 14, color: C.fg1 })}>{d.footer.tagline}</div>
        </div>
      </div>
    </div>
  );

  const img = new ImageResponse(tree, {
    width: 1024, height: 1536,
    fonts: [
      { name: "Inter", data: font("inter-400.ttf"), weight: 400, style: "normal" },
      { name: "Inter", data: font("inter-600.ttf"), weight: 600, style: "normal" },
      { name: "Inter", data: font("inter-700.ttf"), weight: 700, style: "normal" },
      { name: "Inter", data: font("inter-800.ttf"), weight: 800, style: "normal" },
      { name: "JBM", data: font("jbm-700.ttf"), weight: 700, style: "normal" },
    ],
  });
  const buf = await img.arrayBuffer();
  return new Response(buf, { headers: { "Content-Type": "image/png" } });
}
