"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Construction } from "lucide-react";

// Seeded PRNG — same values on server and client (no hydration mismatch)
function mulberry32(seed: number) {
    return () => {
        seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Pre-generate deterministic data
const rng = mulberry32(42);
const STARS = Array.from({ length: 50 }, () => ({
    w: rng() * 2 + 1, h: rng() * 2 + 1,
    top: rng() * 100, left: rng() * 100,
    opacity: rng() * 0.6 + 0.1,
    delay: rng() * 3, dur: rng() * 2 + 1,
}));
const WINDOWS = Array.from({ length: 35 }, () => ({
    x: 30 + rng() * 1140, y: 35 + rng() * 80,
    opacity: rng() * 0.5 + 0.15,
    peak: rng() * 0.6 + 0.3, dur: rng() * 3 + 1.5,
}));

/**
 * Coming Soon — catch-all page for routes under development
 * Features Godzilla vs Gundam RX-78 epic battle animation
 */
export default function ComingSoonPage() {
    const pathname = usePathname();
    const pageName = pathname
        .split("/")
        .filter(Boolean)
        .map(s => s.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()))
        .join(" › ");

    return (
        <div className="relative min-h-screen w-full overflow-hidden bg-linear-to-b from-[#0a0a1a] via-[#111133] to-[#0a0a1a] flex flex-col items-center justify-center text-white select-none">

            {/* Stars */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {STARS.map((s, i) => (
                    <div key={i} className="absolute rounded-full bg-white"
                        style={{
                            width: s.w, height: s.h,
                            top: `${s.top}%`, left: `${s.left}%`,
                            opacity: s.opacity,
                            animationDelay: `${s.delay}s`,
                            animationDuration: `${s.dur}s`,
                        }}
                    />
                ))}
            </div>

            {/* City skyline */}
            <div className="absolute bottom-0 left-0 right-0 h-36 pointer-events-none">
                <svg viewBox="0 0 1200 140" className="w-full h-full" preserveAspectRatio="none">
                    <defs>
                        <linearGradient id="cg" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#1a1a3e" /><stop offset="100%" stopColor="#0a0a1a" />
                        </linearGradient>
                    </defs>
                    <path d="M0,140 L0,90 30,90 30,70 50,70 50,50 65,50 65,80 100,80 100,40 115,40 115,65 140,65 140,50 155,50 155,30 165,30 165,60 200,60 200,80 240,80 240,55 260,55 260,35 270,35 270,70 310,70 310,85 350,85 350,45 370,45 370,25 380,25 380,60 420,60 420,75 460,75 460,40 480,40 480,20 490,20 490,55 530,55 530,75 580,75 580,50 600,50 600,35 610,35 610,65 650,65 650,80 700,80 700,45 720,45 720,60 760,60 760,40 775,40 775,25 785,25 785,70 830,70 830,50 860,50 860,65 900,65 900,80 950,80 950,45 970,45 970,65 1010,65 1010,40 1025,40 1025,60 1060,60 1060,80 1100,80 1100,55 1120,55 1120,70 1160,70 1160,85 1200,85 1200,140 Z"
                        fill="url(#cg)" />
                    {WINDOWS.map((w, i) => (
                        <rect key={i} x={w.x} y={w.y} width={3} height={4} fill="#ffd700" opacity={w.opacity}>
                            <animate attributeName="opacity" values={`0.1;${w.peak};0.1`}
                                dur={`${w.dur}s`} repeatCount="indefinite" />
                        </rect>
                    ))}
                </svg>
            </div>

            {/* Ground / arena floor */}
            <div className="absolute bottom-36 left-0 right-0 h-1 bg-linear-to-r from-transparent via-cyan-500/20 to-transparent" />

            {/* ═══════ BATTLE ARENA ═══════ */}
            <div className="relative w-full max-w-xl h-64 mb-6">

                {/* ── GODZILLA ── */}
                <div className="godzilla-fighter absolute bottom-6 left-8 sm:left-16">
                    <svg viewBox="0 0 100 160" className="w-20 h-32 sm:w-28 sm:h-44" overflow="visible">
                        <path className="gz-tail" d="M25,120 Q5,130 2,150 Q0,158 6,155" fill="none" stroke="#1a3a1a" strokeWidth="9" strokeLinecap="round" />
                        <ellipse cx="48" cy="115" rx="24" ry="35" fill="#1a3a1a" />
                        <ellipse className="gz-head" cx="68" cy="72" rx="16" ry="19" fill="#1e4420" />
                        <path className="gz-jaw" d="M62,82 L88,78 L84,88 L62,86 Z" fill="#162e17" />
                        <circle className="gz-eye" cx="76" cy="68" r="3" fill="#ff4400">
                            <animate attributeName="fill" values="#ff4400;#ff0000;#ffff00;#ff4400" dur="0.5s" repeatCount="indefinite" />
                        </circle>
                        <path d="M70,82 L73,86 L76,82 L79,86 L82,82" fill="none" stroke="#ccddcc" strokeWidth="1" />
                        <path d="M35,90 L30,60 L38,82 L33,45 L42,76 L38,35 L47,70" fill="none" stroke="#2a5a2f" strokeWidth="3.5" strokeLinecap="round" />
                        <path className="gz-arm" d="M65,100 L82,92 L85,98" fill="#1e4420" stroke="#162e17" strokeWidth="1.5" />
                        <rect className="gz-leg-l" x="32" y="138" width="11" height="18" rx="3" fill="#162e17" />
                        <rect className="gz-leg-r" x="50" y="138" width="11" height="18" rx="3" fill="#1a3a1a" />
                        <g className="gz-breath">
                            <line x1="88" y1="80" x2="600" y2="55" stroke="url(#breathG)" strokeWidth="8" strokeLinecap="round" />
                            <line x1="88" y1="80" x2="600" y2="60" stroke="#88ffff" strokeWidth="3" />
                            <line x1="88" y1="80" x2="600" y2="65" stroke="#00eeff" strokeWidth="1.5" opacity="0.5" />
                            <defs>
                                <linearGradient id="breathG" x1="0" x2="1">
                                    <stop offset="0%" stopColor="#00ddff" />
                                    <stop offset="60%" stopColor="#66ffff" />
                                    <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                                </linearGradient>
                            </defs>
                        </g>
                    </svg>
                </div>

                {/* ── GUNDAM RX-78 ── */}
                <div className="gundam-fighter absolute bottom-6 right-8 sm:right-16" style={{ transform: "scaleX(-1)" }}>
                    <svg viewBox="0 0 100 160" className="w-20 h-32 sm:w-28 sm:h-44" overflow="visible">
                        <rect className="gd-leg-l" x="30" y="118" width="13" height="35" rx="2" fill="#e8e8f0" />
                        <rect className="gd-leg-r" x="52" y="118" width="13" height="35" rx="2" fill="#d0d0e0" />
                        <rect x="30" y="130" width="13" height="5" rx="1" fill="#ff3333" />
                        <rect x="52" y="130" width="13" height="5" rx="1" fill="#cc2828" />
                        <path d="M27,150 L46,150 L46,157 L24,157 Z" fill="#e8e8f0" />
                        <path d="M49,150 L68,150 L71,157 L49,157 Z" fill="#d0d0e0" />
                        <path d="M28,118 L68,118 L71,88 L25,88 Z" fill="#e8e8f0" />
                        <polygon points="40,92 56,92 58,108 38,108" fill="#ff3333" />
                        <polygon points="43,95 53,95 54,105 42,105" fill="#ffdd00">
                            <animate attributeName="fill" values="#ffdd00;#ffffff;#ffdd00" dur="1.5s" repeatCount="indefinite" />
                        </polygon>
                        <rect x="16" y="83" width="16" height="10" rx="2" fill="#ff3333" />
                        <rect x="64" y="83" width="16" height="10" rx="2" fill="#cc2828" />
                        <rect className="gd-head" x="38" y="60" width="20" height="24" rx="3" fill="#e8e8f0" />
                        <path d="M48,60 L38,44 L44,58" fill="#ffdd00" />
                        <path d="M48,60 L58,44 L52,58" fill="#ffcc00" />
                        <rect x="40" y="68" width="16" height="5" rx="1" fill="#00ccff">
                            <animate attributeName="fill" values="#00ccff;#00ffff;#ffffff;#00ccff" dur="1s" repeatCount="indefinite" />
                        </rect>
                        <circle cx="48" cy="64" r="2" fill="#ff3333" />
                        <g className="gd-rifle-arm">
                            <path d="M16,88 L25,98 L35,101" fill="none" stroke="#d0d0e0" strokeWidth="5" strokeLinecap="round" />
                            <rect x="35" y="98" width="32" height="5" rx="1" fill="#555566" />
                            <rect x="65" y="97" width="6" height="7" rx="1" fill="#444455" />
                            <g className="gd-muzzle">
                                <circle cx="73" cy="101" r="5" fill="#ffff00" opacity="0.8" />
                                <circle cx="75" cy="101" r="2.5" fill="#ffffff" />
                            </g>
                            <line className="gd-bullet1" x1="80" y1="101" x2="88" y2="101" stroke="#ffff00" strokeWidth="2" strokeLinecap="round" />
                            <line className="gd-bullet2" x1="105" y1="99" x2="113" y2="99" stroke="#ffaa00" strokeWidth="2" strokeLinecap="round" />
                            <line className="gd-bullet3" x1="135" y1="102" x2="143" y2="102" stroke="#ffff00" strokeWidth="1.5" strokeLinecap="round" />
                            <line className="gd-bullet4" x1="170" y1="100" x2="178" y2="100" stroke="#ffcc00" strokeWidth="2" strokeLinecap="round" />
                            <line className="gd-bullet5" x1="205" y1="103" x2="213" y2="103" stroke="#ffff00" strokeWidth="1.5" strokeLinecap="round" />
                            <line className="gd-bullet6" x1="240" y1="98" x2="248" y2="98" stroke="#ffaa00" strokeWidth="2" strokeLinecap="round" />
                            <line className="gd-bullet7" x1="280" y1="101" x2="288" y2="101" stroke="#ffff66" strokeWidth="1.5" strokeLinecap="round" />
                            <line className="gd-bullet8" x1="320" y1="100" x2="328" y2="100" stroke="#ffcc00" strokeWidth="2" strokeLinecap="round" />
                            <line className="gd-bullet9" x1="360" y1="102" x2="368" y2="102" stroke="#ffff00" strokeWidth="1.5" strokeLinecap="round" />
                            <line className="gd-bullet10" x1="400" y1="99" x2="408" y2="99" stroke="#ffaa00" strokeWidth="2" strokeLinecap="round" />
                        </g>
                        <g className="gd-saber-arm" style={{ transformOrigin: '80px 88px' }}>
                            <path d="M80,88 L90,78 L93,75" fill="none" stroke="#d0d0e0" strokeWidth="5" strokeLinecap="round" />
                            <line x1="93" y1="75" x2="130" y2="30" stroke="#ff66ff" strokeWidth="4" opacity="0.9" />
                            <line x1="93" y1="75" x2="130" y2="30" stroke="#ffaaff" strokeWidth="2" />
                            <line x1="93" y1="75" x2="130" y2="30" stroke="#ffffff" strokeWidth="1" opacity="0.6" />
                            <path className="gd-slash-trail" d="M130,30 Q145,55 110,85" fill="none" stroke="#ff88ff" strokeWidth="2" opacity="0" />
                        </g>
                        <ellipse className="gd-thruster" cx="36" cy="155" rx="4" ry="2" fill="#ffaa00" opacity="0.5">
                            <animate attributeName="ry" values="2;6;2" dur="0.25s" repeatCount="indefinite" />
                        </ellipse>
                        <ellipse cx="60" cy="155" rx="4" ry="2" fill="#ffaa00" opacity="0.5">
                            <animate attributeName="ry" values="2;6;2" dur="0.25s" repeatCount="indefinite" />
                        </ellipse>
                    </svg>
                </div>

                {/* ── IMPACT EFFECTS ── */}
                <div className="impact-fx absolute bottom-16 left-1/2 -translate-x-1/2 pointer-events-none">
                    <div className="impact-burst w-20 h-20 rounded-full bg-gradient-radial from-white via-yellow-300 to-transparent blur-md" />
                    <svg className="hit-sparks absolute -top-4 -left-4 w-28 h-28" viewBox="0 0 100 100">
                        <line className="spark1" x1="50" y1="50" x2="10" y2="20" stroke="#ffff00" strokeWidth="2" strokeLinecap="round" />
                        <line className="spark2" x1="50" y1="50" x2="90" y2="15" stroke="#ffaa00" strokeWidth="2" strokeLinecap="round" />
                        <line className="spark3" x1="50" y1="50" x2="15" y2="80" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
                        <line className="spark4" x1="50" y1="50" x2="85" y2="75" stroke="#ff6600" strokeWidth="2" strokeLinecap="round" />
                        <line className="spark5" x1="50" y1="50" x2="50" y2="5" stroke="#ffff66" strokeWidth="1.5" strokeLinecap="round" />
                        <text x="50" y="48" textAnchor="middle" className="hit-text" fontSize="16" fontWeight="bold" fill="#ff3333" opacity="0">POW!</text>
                        <text x="50" y="48" textAnchor="middle" className="hit-text2" fontSize="14" fontWeight="bold" fill="#00ccff" opacity="0">BOOM!</text>
                    </svg>
                </div>

                <div className="shake-overlay absolute inset-0 pointer-events-none border-2 border-transparent rounded-xl" />
            </div>

            {/* ═══════ TEXT ═══════ */}
            <div className="relative z-10 text-center px-4">
                <div className="flex items-center justify-center gap-2 mb-2">
                    <Construction className="h-5 w-5 text-amber-400 animate-bounce" />
                    <h1 className="text-2xl sm:text-3xl font-bold bg-linear-to-r from-amber-400 via-yellow-300 to-amber-400 bg-clip-text text-transparent">
                        Coming Soon
                    </h1>
                    <Construction className="h-5 w-5 text-amber-400 animate-bounce" style={{ animationDelay: "0.2s" }} />
                </div>
                <p className="text-sm text-zinc-400 mb-1">
                    Halaman <span className="text-amber-300 font-semibold">{pageName || "Unknown"}</span> sedang dalam pengembangan
                </p>
                <p className="text-xs text-zinc-600 mb-5">
                    Sementara Godzilla dan Gundam RX-78 adu jotos di sini...
                </p>
                <Link href="/"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-zinc-300 hover:bg-white/10 hover:text-white transition-all duration-200">
                    <ArrowLeft className="h-4 w-4" />
                    Kembali ke Overview
                </Link>
            </div>

            {/* ═══════ FIGHT CHOREOGRAPHY CSS ═══════ */}
            <style jsx>{`
                .godzilla-fighter { animation: gz-fight 8s ease-in-out infinite; }
                .gundam-fighter { animation: gd-fight 8s ease-in-out infinite; }
                .impact-fx { animation: impact-fight 8s ease-in-out infinite; }
                .hit-sparks { animation: sparks-fight 8s ease-in-out infinite; }

                @keyframes gz-fight {
                    0%   { transform: translateX(0) translateY(0) rotate(0deg); }
                    6%   { transform: translateX(10px) translateY(-5px) rotate(-2deg); }
                    12%  { transform: translateX(80px) translateY(-10px) rotate(-5deg); }
                    15%  { transform: translateX(90px) translateY(0px) rotate(3deg); }
                    25%  { transform: translateX(40px) translateY(-15px) rotate(8deg); }
                    30%  { transform: translateX(50px) translateY(-5px) rotate(-3deg); }
                    37%  { transform: translateX(85px) translateY(0px) rotate(-8deg); }
                    42%  { transform: translateX(70px) translateY(-5px) rotate(2deg); }
                    50%  { transform: translateX(30px) translateY(-8px) rotate(0deg); }
                    56%  { transform: translateX(20px) translateY(-12px) rotate(-3deg); }
                    62%  { transform: translateX(60px) translateY(-5px) rotate(-6deg); }
                    70%  { transform: translateX(50px) translateY(0px) rotate(-4deg); }
                    75%  { transform: translateX(85px) translateY(-8px) rotate(-5deg); }
                    80%  { transform: translateX(95px) translateY(3px) rotate(4deg); }
                    87%  { transform: translateX(30px) translateY(-10px) rotate(5deg); }
                    93%  { transform: translateX(10px) translateY(-3px) rotate(1deg); }
                    100% { transform: translateX(0) translateY(0) rotate(0deg); }
                }

                @keyframes gd-fight {
                    0%   { transform: scaleX(-1) translateX(0) translateY(0) rotate(0deg); }
                    6%   { transform: scaleX(-1) translateX(10px) translateY(-8px) rotate(2deg); }
                    12%  { transform: scaleX(-1) translateX(75px) translateY(-12px) rotate(5deg); }
                    15%  { transform: scaleX(-1) translateX(85px) translateY(0px) rotate(-3deg); }
                    22%  { transform: scaleX(-1) translateX(90px) translateY(-25px) rotate(-8deg); }
                    25%  { transform: scaleX(-1) translateX(70px) translateY(-10px) rotate(0deg); }
                    37%  { transform: scaleX(-1) translateX(20px) translateY(5px) rotate(10deg); }
                    42%  { transform: scaleX(-1) translateX(40px) translateY(-5px) rotate(-2deg); }
                    50%  { transform: scaleX(-1) translateX(80px) translateY(-15px) rotate(-6deg); }
                    55%  { transform: scaleX(-1) translateX(85px) translateY(-8px) rotate(3deg); }
                    62%  { transform: scaleX(-1) translateX(20px) translateY(-30px) rotate(0deg); }
                    68%  { transform: scaleX(-1) translateX(30px) translateY(-10px) rotate(-3deg); }
                    75%  { transform: scaleX(-1) translateX(80px) translateY(-8px) rotate(5deg); }
                    80%  { transform: scaleX(-1) translateX(90px) translateY(3px) rotate(-4deg); }
                    87%  { transform: scaleX(-1) translateX(30px) translateY(-5px) rotate(-5deg); }
                    93%  { transform: scaleX(-1) translateX(10px) translateY(-2px) rotate(-1deg); }
                    100% { transform: scaleX(-1) translateX(0) translateY(0) rotate(0deg); }
                }

                @keyframes impact-fight {
                    0%   { opacity: 0; transform: translate(-50%, 0) scale(0.3); }
                    13%  { opacity: 0; transform: translate(-50%, 0) scale(0.3); }
                    15%  { opacity: 1; transform: translate(-50%, 0) scale(1.5); }
                    18%  { opacity: 0; transform: translate(-50%, 0) scale(0.5); }
                    22%  { opacity: 0.8; transform: translate(-50%, -20px) scale(1.2); }
                    25%  { opacity: 0; transform: translate(-50%, -10px) scale(0.4); }
                    37%  { opacity: 0.9; transform: translate(-50%, 0) scale(1.3); }
                    40%  { opacity: 0; transform: translate(-50%, 0) scale(0.3); }
                    50%  { opacity: 0.7; transform: translate(-50%, -5px) scale(1.0); }
                    53%  { opacity: 0; transform: translate(-50%, 0) scale(0.3); }
                    62%  { opacity: 0.6; transform: translate(-50%, -10px) scale(1.8); }
                    66%  { opacity: 0; transform: translate(-50%, 0) scale(0.3); }
                    80%  { opacity: 1; transform: translate(-50%, 0) scale(2.0); }
                    85%  { opacity: 0; transform: translate(-50%, 0) scale(0.3); }
                    100% { opacity: 0; transform: translate(-50%, 0) scale(0.3); }
                }

                @keyframes sparks-fight { 0%{opacity:0}14%{opacity:0}15%{opacity:1}19%{opacity:0}21%{opacity:0}22%{opacity:1}26%{opacity:0}36%{opacity:0}37%{opacity:1}41%{opacity:0}49%{opacity:0}50%{opacity:1}54%{opacity:0}79%{opacity:0}80%{opacity:1}84%{opacity:0}100%{opacity:0} }

                .hit-text { animation: pow-text 8s ease-in-out infinite; }
                .hit-text2 { animation: boom-text 8s ease-in-out infinite; }
                @keyframes pow-text { 0%,14%,18%,36%,40%,100%{opacity:0;transform:scale(0.5) translateY(0)} 15%{opacity:1;transform:scale(1.5) translateY(-10px)} 17%{opacity:0.5;transform:scale(1.8) translateY(-20px)} 37%{opacity:1;transform:scale(1.3) translateY(-8px)} 39%{opacity:0.5;transform:scale(1.6) translateY(-18px)} }
                @keyframes boom-text { 0%,21%,26%,49%,54%,79%,84%,100%{opacity:0;transform:scale(0.5) translateY(0)} 22%{opacity:1;transform:scale(1.4) translateY(-12px)} 25%{opacity:0.3;transform:scale(1.7) translateY(-22px)} 50%{opacity:1;transform:scale(1.3) translateY(-8px)} 53%{opacity:0.3;transform:scale(1.6) translateY(-18px)} 80%{opacity:1;transform:scale(1.8) translateY(-10px)} 83%{opacity:0.3;transform:scale(2.0) translateY(-20px)} }

                .gz-breath { animation: breath-vis 8s ease-in-out infinite; }
                @keyframes breath-vis { 0%,55%,70%,100%{opacity:0} 60%{opacity:0.3} 62%{opacity:1} 66%{opacity:0.8} 68%{opacity:0} }

                .gd-saber-arm { animation: saber-slash 8s ease-in-out infinite; }
                @keyframes saber-slash { 0%{transform:rotate(0deg)} 6%{transform:rotate(0deg)} 13%{transform:rotate(60deg)} 15%{transform:rotate(-30deg)} 17%{transform:rotate(0deg)} 20%{transform:rotate(50deg)} 22%{transform:rotate(-40deg)} 24%{transform:rotate(0deg)} 35%{transform:rotate(20deg)} 38%{transform:rotate(0deg)} 47%{transform:rotate(70deg)} 50%{transform:rotate(-45deg)} 52%{transform:rotate(10deg)} 54%{transform:rotate(0deg)} 60%{transform:rotate(30deg)} 65%{transform:rotate(0deg)} 76%{transform:rotate(65deg)} 78%{transform:rotate(-50deg)} 80%{transform:rotate(55deg)} 82%{transform:rotate(-35deg)} 84%{transform:rotate(0deg)} 100%{transform:rotate(0deg)} }
                .gd-slash-trail { animation: slash-trail 8s ease-in-out infinite; }
                @keyframes slash-trail { 0%,12%,17%,19%,24%,46%,52%,75%,84%,100%{opacity:0} 15%{opacity:0.8} 22%{opacity:0.7} 50%{opacity:0.9} 78%{opacity:0.8} 80%{opacity:0.9} }

                .gd-muzzle,.gd-bullet1,.gd-bullet2,.gd-bullet3,.gd-bullet4,.gd-bullet5,.gd-bullet6,.gd-bullet7,.gd-bullet8,.gd-bullet9,.gd-bullet10{animation:bullet-vis 8s ease-in-out infinite}
                .gd-bullet2{animation-delay:0.08s}.gd-bullet3{animation-delay:0.16s}.gd-bullet4{animation-delay:0.24s}.gd-bullet5{animation-delay:0.32s}.gd-bullet6{animation-delay:0.40s}.gd-bullet7{animation-delay:0.48s}.gd-bullet8{animation-delay:0.56s}.gd-bullet9{animation-delay:0.64s}.gd-bullet10{animation-delay:0.72s}
                @keyframes bullet-vis { 0%,11%,26%,35%,55%,69%,86%,100%{opacity:0} 12%{opacity:1} 25%{opacity:0.8} 42%{opacity:1} 54%{opacity:0.8} 70%{opacity:1} 85%{opacity:0.8} }
                .gd-muzzle{animation:muzzle-flash 0.15s steps(2) infinite}
                @keyframes muzzle-flash { 0%{opacity:0.9;transform:scale(1)} 50%{opacity:0.3;transform:scale(0.6)} 100%{opacity:0.9;transform:scale(1.2)} }

                .shake-overlay{animation:screen-shake 8s ease-in-out infinite}
                @keyframes screen-shake { 0%,14%,16%,21%,24%,36%,39%,79%,83%,100%{transform:translate(0,0)} 15%{transform:translate(-3px,2px)} 15.5%{transform:translate(3px,-2px)} 22%{transform:translate(2px,3px)} 22.5%{transform:translate(-2px,-1px)} 37%{transform:translate(-4px,1px)} 37.5%{transform:translate(2px,-3px)} 80%{transform:translate(-5px,3px)} 80.5%{transform:translate(4px,-2px)} 81%{transform:translate(-2px,4px)} 81.5%{transform:translate(3px,-3px)} }
            `}</style>
        </div>
    );
}
