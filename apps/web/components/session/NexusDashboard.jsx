import { useState, useEffect, useRef, useCallback } from "react";

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const BASE_TIMEOUT = 120;
const WARN_AT = 30;
const DEBOUNCE_MS = 1500;
const EVENTS = ["mousemove", "keydown", "mousedown", "touchstart", "scroll", "click"];
const fmt = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
const now = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`; };

// ─── STATIC DATA ─────────────────────────────────────────────────────────────
const TXNS = [
  { id: "TXN-9821", type: "Freight Transfer", amount: "₹4,82,000", risk: "LOW", status: "CLEARED", route: "MUM→DEL", time: "09:42" },
  { id: "TXN-9819", type: "Cold Chain", amount: "₹1,23,500", risk: "MEDIUM", status: "IN TRANSIT", route: "BLR→HYD", time: "09:38" },
  { id: "TXN-9817", type: "Express Courier", amount: "₹18,250", risk: "LOW", status: "DELIVERED", route: "CHE→PUN", time: "09:31" },
  { id: "TXN-9814", type: "Bulk Cargo", amount: "₹9,94,000", risk: "HIGH", status: "FLAGGED", route: "KOL→MUM", time: "09:24" },
  { id: "TXN-9810", type: "Last Mile Delivery", amount: "₹6,750", risk: "LOW", status: "CLEARED", route: "DEL→NCR", time: "09:17" },
];

const RISK_C = { LOW: "#00e5a0", MEDIUM: "#f5c518", HIGH: "#ff4d4d" };
const STAT_C = { CLEARED: "#00e5a0", DELIVERED: "#00c8b0", "IN TRANSIT": "#f5c518", FLAGGED: "#ff4d4d" };

const INIT_LOGS = [
  { t: "09:42:11", msg: "TXN-9821 authorized — ₹4,82,000 cleared", type: "success" },
  { t: "09:39:05", msg: "2FA TOTP verified — device fingerprint matched", type: "info" },
  { t: "09:38:47", msg: "Cold chain anomaly acknowledged by manager", type: "warn" },
  { t: "09:35:22", msg: "JWT rotated — new token issued", type: "info" },
  { t: "09:30:00", msg: "Session opened — IP 10.0.4.21 · TLS 1.3", type: "success" },
];

const INIT_TIMELINE = [
  { pct: 0, label: "Login", icon: "🔑", type: "success" },
  { pct: 12, label: "2FA OK", icon: "✓", type: "success" },
  { pct: 28, label: "TXN×3", icon: "⬡", type: "info" },
  { pct: 45, label: "JWT Rot.", icon: "↺", type: "info" },
  { pct: 61, label: "Warning", icon: "⚠", type: "warn" },
  { pct: 72, label: "Extend", icon: "↑", type: "success" },
  { pct: 85, label: "TXN Flag", icon: "◆", type: "warn" },
  { pct: 100, label: "NOW", icon: "●", type: "now" },
];

const TABS_DATA = [
  { id: "tab-1", title: "Dashboard", route: "/dashboard", active: true, idle: false, lastAct: "09:42:09" },
  { id: "tab-2", title: "Transactions", route: "/txn", active: false, idle: false, lastAct: "09:38:22" },
  { id: "tab-3", title: "Reports", route: "/reports", active: false, idle: true, lastAct: "09:21:00" },
];

const COMPARISON = [
  { feature: "Inactivity Timeout", nexus: "✓ Risk-Adaptive (45s–4h)", okta: "✓ Fixed only", azure: "✓ Fixed only", ping: "✓ Fixed only", aws: "✓ Fixed only" },
  { feature: "Behavioral Biometrics", nexus: "✓ Live scoring", okta: "✗", azure: "✗", ping: "Partial", aws: "✗" },
  { feature: "Risk-Adaptive Timeout", nexus: "✓ Real-time", okta: "✗", azure: "✗", ping: "✗", aws: "✗" },
  { feature: "Cross-Tab Kill Switch", nexus: "✓ Per-tab control", okta: "✗", azure: "✗", ping: "✗", aws: "✗" },
  { feature: "Session Replay Timeline", nexus: "✓ Full scrubable", okta: "Partial logs", azure: "Partial logs", ping: "✗", aws: "✗" },
  { feature: "Geo-fence Map", nexus: "✓ Live + anomaly rings", okta: "Basic geo", azure: "Conditional", ping: "Basic geo", aws: "✗" },
  { feature: "Warning Modal UX", nexus: "✓ Countdown + extend", okta: "✓ Basic", azure: "✓ Basic", ping: "✓ Basic", aws: "✗" },
  { feature: "Audit Log", nexus: "✓ Immutable + SIEM", okta: "✓", azure: "✓", ping: "✓", aws: "✓" },
  { feature: "JWT Rotation", nexus: "✓ 5-min rolling", okta: "✓", azure: "✓", ping: "✓", aws: "✓" },
  { feature: "Logistics Domain Rules", nexus: "✓ TXN-value based", okta: "✗", azure: "✗", ping: "✗", aws: "✗" },
];

const TECH_STACK = [
  { layer: "Frontend", tech: "Next.js 14 (App Router) + React 18", why: "SSR for secure page loads; React concurrent for real-time UI", color: "#00e5a0" },
  { layer: "Auth", tech: "NextAuth.js + TOTP (otplib)", why: "Server-side session, CSRF protection, 2FA out of the box", color: "#00c8b0" },
  { layer: "Session Store", tech: "Redis (Upstash) — encrypted at rest", why: "Sub-ms reads, TTL per session, cluster failover", color: "#f5c518" },
  { layer: "Realtime Sync", tech: "WebSockets via Socket.io / Pusher", why: "Cross-tab session events, tab kill-switch signalling", color: "#00e5a0" },
  { layer: "Biometrics", tech: "Custom JS + ML (TensorFlow.js / ONNX Web)", why: "In-browser inference — keystroke/mouse cadence scoring", color: "#a78bfa" },
  { layer: "Geo / Map", tech: "Mapbox GL JS + MaxMind GeoIP2", why: "Accurate city-level IP geo, offline DB option for compliance", color: "#00c8b0" },
  { layer: "Backend API", tech: "FastAPI (Python) + Pydantic", why: "Async, fast, typed; ideal for risk-scoring microservice", color: "#f5c518" },
  { layer: "Database", tech: "PostgreSQL (Supabase) + TimescaleDB ext.", why: "Append-only audit log, time-series events for replay", color: "#00e5a0" },
  { layer: "Infra", tech: "Vercel (edge) + Railway (services)", why: "Zero-config deploy, global edge CDN, auto-scaling", color: "#ff7a50" },
  { layer: "Monitoring", tech: "Grafana + Loki + OpenTelemetry", why: "Session trace spans, alert on anomaly events", color: "#a78bfa" },
  { layer: "Security Scan", tech: "Snyk + OWASP ZAP + Trivy (CI)", why: "Continuous dependency + DAST + container scanning", color: "#ff4d4d" },
];

const DEPLOY_STEPS = [
  { n: "01", title: "Repo & Monorepo Setup", desc: "pnpm workspaces — apps/web, apps/api, packages/session-engine, packages/biometrics", cmd: "pnpm create next-app --ts && git init" },
  { n: "02", title: "Redis Session Store", desc: "Upstash Redis with AES-256 value encryption; session keys include user fingerprint hash", cmd: "upstash redis create --region ap-south-1" },
  { n: "03", title: "Auth & JWT Rotation", desc: "NextAuth with custom JWT strategy; rolling 5-min access token + 7-day refresh in HttpOnly cookie", cmd: "npm i next-auth otplib qrcode" },
  { n: "04", title: "Session Engine Package", desc: "Shared pkg: inactivityTimer, riskAdaptiveTimeout, crossTabSync via BroadcastChannel + WS fallback", cmd: "packages/session-engine/index.ts" },
  { n: "05", title: "Biometrics Worker", desc: "Web Worker runs keystroke-timing + mouse-velocity scoring; posts trust delta to main thread every 10s", cmd: "new Worker('./biometrics.worker.ts')" },
  { n: "06", title: "FastAPI Risk Service", desc: "Python microservice: receives session context, returns risk score 0-100; calls MaxMind + fraud rules", cmd: "uvicorn main:app --host 0.0.0.0 --port 8000" },
  { n: "07", title: "Deploy: Vercel + Railway", desc: "Next.js → Vercel edge; FastAPI → Railway; Redis → Upstash; DB → Supabase (pgbouncer pooling)", cmd: "vercel deploy && railway up" },
  { n: "08", title: "Observability", desc: "OpenTelemetry SDK traces every session event; Grafana dashboard with p95 logout-latency alert", cmd: "docker-compose up grafana loki tempo" },
];

// ─── TINY ATOMS ──────────────────────────────────────────────────────────────
const Dot = ({ c, pulse }) => (
  <span style={{ position: "relative", display: "inline-flex", width: 9, height: 9, alignItems: "center", justifyContent: "center" }}>
    {pulse && <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: c, animation: "ping 1.5s ease-out infinite", opacity: .5 }} />}
    <span style={{ width: 7, height: 7, borderRadius: "50%", background: c, display: "block" }} />
  </span>
);

const Tag = ({ children, c = "#00e5a0" }) => (
  <span style={{ fontSize: 9, letterSpacing: 1.2, padding: "2px 8px", borderRadius: 4, color: c, background: `${c}18`, border: `1px solid ${c}33`, fontFamily: "monospace" }}>
    {children}
  </span>
);

const Pill = ({ label, val, c }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
    <span style={{ fontSize: 11, color: "#4a6080" }}>{label}</span>
    <Tag c={c}>{val}</Tag>
  </div>
);

const Bar = ({ label, value, c = "#00e5a0" }) => (
  <div style={{ marginBottom: 9 }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
      <span style={{ fontSize: 9, color: "#3a5070", letterSpacing: 1 }}>{label}</span>
      <span style={{ fontSize: 9, color: c, fontFamily: "monospace" }}>{value}%</span>
    </div>
    <div style={{ height: 3, background: "#0d1726", borderRadius: 2, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${value}%`, background: c, borderRadius: 2, transition: "width 1.2s ease", boxShadow: `0 0 6px ${c}88` }} />
    </div>
  </div>
);

// ─── RING TIMER ───────────────────────────────────────────────────────────────
function RingTimer({ remaining, total, warn, crit }) {
  const r = 50, circ = 2 * Math.PI * r;
  const pct = remaining / total, dash = circ * pct;
  const c = crit ? "#ff4d4d" : warn ? "#f5c518" : "#00e5a0";
  return (
    <svg width="130" height="130" viewBox="0 0 130 130" style={{ filter: `drop-shadow(0 0 14px ${c}44)` }}>
      <circle cx="65" cy="65" r={r} fill="none" stroke="#0d1726" strokeWidth="9" />
      <circle cx="65" cy="65" r={r} fill="none" stroke={c} strokeWidth="9" strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`} strokeDashoffset={circ * .25}
        style={{ transition: "stroke-dasharray .8s cubic-bezier(.4,0,.2,1),stroke .4s" }} />
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12 * 360 - 90) * Math.PI / 180;
        return <line key={i} x1={65 + 43 * Math.cos(a)} y1={65 + 43 * Math.sin(a)} x2={65 + 47 * Math.cos(a)} y2={65 + 47 * Math.sin(a)} stroke="#1a2b3f" strokeWidth="1.5" />;
      })}
      <text x="65" y="60" textAnchor="middle" fill={c} fontSize="20" fontWeight="700" fontFamily="'JetBrains Mono',monospace">{fmt(remaining)}</text>
      <text x="65" y="76" textAnchor="middle" fill="#3a5070" fontSize="8" fontFamily="'JetBrains Mono',monospace" letterSpacing="2">SESSION</text>
    </svg>
  );
}

// ─── BEHAVIORAL BIOMETRICS PANEL ──────────────────────────────────────────────
function BiometricsPanel({ trustScore, mouseVel, keystrokeRhythm, scrollPattern }) {
  const bars = [
    { label: "KEYSTROKE CADENCE", val: keystrokeRhythm, c: keystrokeRhythm > 75 ? "#00e5a0" : "#f5c518" },
    { label: "MOUSE VELOCITY", val: mouseVel, c: mouseVel > 70 ? "#00e5a0" : "#f5c518" },
    { label: "SCROLL BEHAVIOUR", val: scrollPattern, c: scrollPattern > 80 ? "#00e5a0" : "#f5c518" },
    { label: "CLICK PATTERN", val: 88, c: "#00e5a0" },
    { label: "DWELL TIME", val: 92, c: "#00e5a0" },
  ];
  const tc = trustScore > 80 ? "#00e5a0" : trustScore > 60 ? "#f5c518" : "#ff4d4d";
  return (
    <div style={{ background: "#050505", border: "1px solid #1a1a1a", borderRadius: 14, padding: "18px", transition: "all .3s" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 9, letterSpacing: 3, color: "#555" }}>BEHAVIOURAL BIOMETRICS</div>
        <Tag c="#a78bfa">🧬 LIVE</Tag>
      </div>
      <div style={{ textAlign: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 38, fontWeight: 800, color: tc, fontFamily: "'JetBrains Mono',monospace", filter: `drop-shadow(0 0 10px ${tc}66)` }}>{trustScore}</div>
        <div style={{ fontSize: 9, color: "#3a5070", letterSpacing: 2 }}>BEHAVIOUR TRUST SCORE</div>
      </div>
      {bars.map(b => <Bar key={b.label} label={b.label} value={b.val} c={b.c} />)}
      <div style={{ marginTop: 10, padding: "8px 10px", background: "#11111188", borderRadius: 8, border: "1px solid #a78bfa22" }}>
        <span style={{ fontSize: 10, color: "#a78bfa" }}>✦ </span>
        <span style={{ fontSize: 10, color: "#666" }}>Score below 60 triggers step-up auth</span>
      </div>
    </div>
  );
}

// ─── RISK ADAPTIVE TIMEOUT PANEL ─────────────────────────────────────────────
function RiskAdaptivePanel({ riskLevel, adaptedTimeout, baseTimeout, factors }) {
  const c = riskLevel === "LOW" ? "#00e5a0" : riskLevel === "MEDIUM" ? "#f5c518" : "#ff4d4d";
  const pct = Math.round((adaptedTimeout / baseTimeout) * 100);
  return (
    <div style={{ background: "#050505", border: `1px solid ${c}33`, borderRadius: 14, padding: "18px", boxShadow: `inset 0 0 20px ${c}05` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 9, letterSpacing: 3, color: "#555" }}>RISK-ADAPTIVE TIMEOUT</div>
        <Tag c={c}>⬟ {riskLevel}</Tag>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1, textAlign: "center", background: "#111111", borderRadius: 10, padding: "10px", border: "1px solid #1a1a1a" }}>
          <div style={{ fontSize: 9, color: "#555", letterSpacing: 1, marginBottom: 4 }}>BASE</div>
          <div style={{ fontFamily: "monospace", fontSize: 16, color: "#777" }}>{fmt(baseTimeout)}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", color: "#444", fontSize: 14 }}>→</div>
        <div style={{ flex: 1, textAlign: "center", background: `${c}11`, border: `1px solid ${c}33`, borderRadius: 10, padding: "10px" }}>
          <div style={{ fontSize: 9, color: c, letterSpacing: 1, marginBottom: 4 }}>ADAPTED</div>
          <div style={{ fontFamily: "monospace", fontSize: 16, color: c, fontWeight: 700 }}>{fmt(adaptedTimeout)}</div>
        </div>
      </div>
      <div style={{ height: 4, background: "#111111", borderRadius: 2, marginBottom: 14, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: c, borderRadius: 2, transition: "width 1s ease" }} />
      </div>
      <div style={{ fontSize: 9, color: "#3a5070", letterSpacing: 2, marginBottom: 8 }}>ACTIVE RISK FACTORS</div>
      {factors.map((f, i) => (
        <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 8, color: f.impact === "+" ? "#ff4d4d" : "#00e5a0" }}>{f.impact === "+" ? "▲" : "▼"}</span>
          <span style={{ fontSize: 11, color: "#5a7a9a", flex: 1 }}>{f.label}</span>
          <span style={{ fontSize: 10, color: f.impact === "+" ? "#ff4d4d" : "#00e5a0", fontFamily: "monospace" }}>{f.impact}{f.delta}s</span>
        </div>
      ))}
    </div>
  );
}

// ─── CROSS-TAB SYNC PANEL ─────────────────────────────────────────────────────
function CrossTabPanel({ tabs, onKillTab }) {
  return (
    <div style={{ background: "#050505", border: "1px solid #1a1a1a", borderRadius: 14, padding: "18px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 9, letterSpacing: 3, color: "#555" }}>CROSS-TAB SESSION SYNC</div>
        <Tag c="#00c8b0">{tabs.length} TABS</Tag>
      </div>
      {tabs.map(tab => (
        <div key={tab.id} style={{
          display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
          background: tab.active ? "#111111" : "#000000", borderRadius: 10, marginBottom: 8,
          border: tab.idle ? "1px solid #ff4d4d22" : "1px solid #1a1a1a"
        }}>
          <Dot c={tab.idle ? "#ff4d4d" : tab.active ? "#00e5a0" : "#f5c518"} pulse={tab.active} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: tab.active ? "#f0f6ff" : "#5a7a9a", fontWeight: tab.active ? 700 : 400 }}>{tab.title}</div>
            <div style={{ fontSize: 9, color: "#3a5070", fontFamily: "monospace" }}>{tab.route} · last: {tab.lastAct}</div>
          </div>
          {tab.idle && <Tag c="#ff4d4d">IDLE</Tag>}
          {!tab.active && (
            <button onClick={() => onKillTab(tab.id)} style={{
              background: "#ff4d4d18", border: "1px solid #ff4d4d33", color: "#ff4d4d",
              borderRadius: 6, padding: "3px 10px", fontSize: 9, cursor: "pointer", letterSpacing: 1
            }}>KILL</button>
          )}
          {tab.active && <Tag c="#00e5a0">ACTIVE</Tag>}
        </div>
      ))}
      <div style={{ marginTop: 10, padding: "8px 10px", background: "#11111188", borderRadius: 8, border: "1px solid #00c8b022" }}>
        <span style={{ fontSize: 10, color: "#666" }}>⬡ All tabs share one session token via BroadcastChannel + WebSocket</span>
      </div>
    </div>
  );
}

// ─── SESSION REPLAY TIMELINE ──────────────────────────────────────────────────
function ReplayTimeline({ events, scrub, onScrub }) {
  return (
    <div style={{ background: "#050505", border: "1px solid #1a1a1a", borderRadius: 14, padding: "18px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 9, letterSpacing: 3, color: "#555" }}>SESSION REPLAY TIMELINE</div>
        <Tag c="#f5c518">47:32 ELAPSED</Tag>
      </div>
      {/* Scrubber track */}
      <div style={{ position: "relative", marginBottom: 12 }}>
        <div style={{ height: 3, background: "#111111", borderRadius: 2, position: "relative" }}>
          <div style={{ height: "100%", width: `${scrub}%`, background: "linear-gradient(90deg,#00e5a0,#00c8b0)", borderRadius: 2, transition: "width .1s", boxShadow: "0 0 10px #00e5a066" }} />
          {events.map((e, i) => {
            const tc = e.type === "success" ? "#00e5a0" : e.type === "warn" ? "#f5c518" : e.type === "now" ? "#fff" : "#5a7a9a";
            return (
              <div key={i} title={e.label} style={{
                position: "absolute", left: `${e.pct}%`, top: "50%", transform: "translate(-50%,-50%)",
                width: e.type === "now" ? 10 : 7, height: e.type === "now" ? 10 : 7,
                borderRadius: "50%", background: tc, cursor: "pointer",
                boxShadow: `0 0 6px ${tc}88`, border: `1px solid ${tc}`,
                zIndex: 2
              }} />
            );
          })}
        </div>
        <input type="range" min="0" max="100" value={scrub} onChange={e => onScrub(Number(e.target.value))}
          style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%" }} />
      </div>
      {/* Event labels */}
      <div style={{ position: "relative", height: 28 }}>
        {events.map((e, i) => {
          const tc = e.type === "success" ? "#00e5a0" : e.type === "warn" ? "#f5c518" : e.type === "now" ? "#fff" : "#4a6080";
          const shouldShow = Math.abs(e.pct - scrub) < 12 || e.type === "now";
          return (
            <div key={i} style={{
              position: "absolute", left: `${e.pct}%`, transform: "translateX(-50%)",
              textAlign: "center", transition: "opacity .3s", opacity: shouldShow ? 1 : 0.3
            }}>
              <div style={{ fontSize: 11 }}>{e.icon}</div>
              <div style={{ fontSize: 7, color: tc, letterSpacing: .5, whiteSpace: "nowrap" }}>{e.label}</div>
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
        {[["#00e5a0", "Success"], ["#f5c518", "Warning"], ["#5a7a9a", "Info"], ["#fff", "Now"]].map(([c, l]) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: c, display: "block" }} />
            <span style={{ fontSize: 9, color: "#3a5070" }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── GEO-FENCE MAP ────────────────────────────────────────────────────────────
function GeoFenceMap({ threatLevel }) {
  const zones = [
    { name: "Mumbai HQ", x: 62, y: 52, r: 8, c: "#00e5a0", trusted: true, you: true },
    { name: "Delhi Office", x: 55, y: 38, r: 7, c: "#00e5a0", trusted: true, you: false },
    { name: "Bangalore", x: 55, y: 62, r: 6, c: "#00e5a0", trusted: true, you: false },
    { name: "Anomaly", x: 30, y: 30, r: 12, c: "#ff4d4d", trusted: false, you: false },
  ];
  // SVG world map simplified path
  return (
    <div style={{ background: "#050505", border: "1px solid #1a1a1a", borderRadius: 14, padding: "18px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 9, letterSpacing: 3, color: "#555" }}>GEO-FENCE & DEVICE TRUST</div>
        <Tag c={threatLevel === "CLEAR" ? "#00e5a0" : "#ff4d4d"}>{threatLevel === "CLEAR" ? "✦ CLEAR" : "⚠ ANOMALY"}</Tag>
      </div>
      <div style={{ position: "relative", background: "#000000", borderRadius: 10, overflow: "hidden", height: 160, border: "1px solid #111111" }}>
        {/* Grid overlay */}
        <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <line key={`h${i}`} x1="0" y1={`${(i + 1) * 12.5}%`} x2="100%" y2={`${(i + 1) * 12.5}%`} stroke="#1e2d4522" strokeWidth="1" />
          ))}
          {Array.from({ length: 10 }).map((_, i) => (
            <line key={`v${i}`} x1={`${(i + 1) * 10}%`} y1="0" x2={`${(i + 1) * 10}%`} y2="100%" stroke="#1e2d4522" strokeWidth="1" />
          ))}
          {/* India rough outline hint */}
          <ellipse cx="58%" cy="55%" rx="8%" ry="12%" fill="none" stroke="#1e2d4544" strokeWidth="1" strokeDasharray="3,3" />
          {/* Anomaly pulse rings */}
          <circle cx="30%" cy="30%" r="18%" fill="none" stroke="#ff4d4d" strokeWidth="1" opacity="0.2" style={{ animation: "ping 2s ease-out infinite" }} />
          <circle cx="30%" cy="30%" r="12%" fill="none" stroke="#ff4d4d" strokeWidth="1" opacity="0.3" style={{ animation: "ping 2s ease-out .5s infinite" }} />
          {/* Connection lines */}
          {zones.filter(z => z.trusted).map((z, i) => (
            <line key={i} x1="62%" y1="52%" x2={`${z.x}%`} y2={`${z.y}%`} stroke="#00e5a033" strokeWidth="1" strokeDasharray="4,3" />
          ))}
          <line x1="30%" y1="30%" x2="62%" y2="52%" stroke="#ff4d4d33" strokeWidth="1" strokeDasharray="4,3" />
          {/* Zone dots */}
          {zones.map((z, i) => (
            <g key={i}>
              <circle cx={`${z.x}%`} cy={`${z.y}%`} r={z.r} fill={`${z.c}22`} stroke={z.c} strokeWidth="1.5" />
              {z.you && <circle cx={`${z.x}%`} cy={`${z.y}%`} r="3.5" fill={z.c} />}
              {!z.trusted && <text x={`${z.x}%`} y={`${z.y}%`} textAnchor="middle" dominantBaseline="middle" fontSize="10">⚠</text>}
            </g>
          ))}
          {/* Labels */}
          {zones.map((z, i) => (
            <text key={`l${i}`} x={`${z.x}%`} y={`${z.y + 8}%`} textAnchor="middle" fill={z.c} fontSize="7" fontFamily="monospace">{z.name}</text>
          ))}
        </svg>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <Tag c="#00e5a0">● Trusted Zone</Tag>
        <Tag c="#ff4d4d">⚠ Anomaly Detected</Tag>
        <Tag c="#f5c518">◆ You</Tag>
        <Tag c="#5a7a9a">MaxMind GeoIP2</Tag>
      </div>
    </div>
  );
}

// ─── COMPARISON TABLE ─────────────────────────────────────────────────────────
function ComparisonTable() {
  const cols = ["feature", "nexus", "okta", "azure", "ping", "aws"];
  const cHeaders = ["FEATURE", "NEXUS TLS ✦", "OKTA", "AZURE AD", "PING ID", "AWS COGNITO"];
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
        <thead>
          <tr>
            {cols.map((c, i) => (
              <th key={c} style={{
                padding: "10px 14px", textAlign: "left", fontSize: 9, letterSpacing: 1.5,
                color: i === 1 ? "#00e5a0" : "#3a5070",
                borderBottom: `1px solid ${i === 1 ? "#00e5a033" : "#1e2d45"}`,
                background: i === 1 ? "#00e5a008" : "transparent",
                whiteSpace: "nowrap"
              }}>{cHeaders[i]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COMPARISON.map((row, ri) => (
            <tr key={ri} style={{ borderBottom: "1px solid #1e2d4533", background: ri % 2 === 0 ? "#060d1a" : "transparent" }}>
              {cols.map((c, ci) => {
                const v = row[c];
                const isNexus = ci === 1;
                const isCheck = v.startsWith("✓");
                const isCross = v.startsWith("✗");
                return (
                  <td key={c} style={{
                    padding: "10px 14px",
                    color: isNexus ? (isCheck ? "#00e5a0" : "#f5c518") : isCross ? "#2a3d50" : isCheck ? "#4a7a60" : "#5a7a9a",
                    fontWeight: isNexus ? 600 : 400,
                    background: isNexus ? "#00e5a006" : "transparent",
                    borderLeft: isNexus ? "1px solid #00e5a022" : "none",
                    borderRight: isNexus ? "1px solid #00e5a022" : "none"
                  }}>{v}</td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── TECH STACK VIEW ──────────────────────────────────────────────────────────
function TechStackView() {
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 12, marginBottom: 20 }}>
        {TECH_STACK.map(s => (
          <div key={s.layer} style={{ background: "#050505", border: `1px solid ${s.color}22`, borderRadius: 12, padding: "16px" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
              <span style={{ fontSize: 9, color: s.color, letterSpacing: 2 }}>{s.layer.toUpperCase()}</span>
            </div>
            <div style={{ fontSize: 13, color: "#f0f6ff", fontWeight: 600, marginBottom: 6, fontFamily: "'JetBrains Mono',monospace" }}>{s.tech}</div>
            <div style={{ fontSize: 11, color: "#4a6080", lineHeight: 1.6 }}>{s.why}</div>
          </div>
        ))}
      </div>
      {/* Architecture diagram */}
      <div style={{ background: "#050505", border: "1px solid #1a1a1a", borderRadius: 14, padding: "20px" }}>
        <div style={{ fontSize: 9, letterSpacing: 3, color: "#555", marginBottom: 16 }}>DEPLOYMENT ARCHITECTURE</div>
        <div style={{ display: "flex", alignItems: "center", gap: 0, flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
          {[
            { label: "Browser", c: "#00e5a0", icon: "🌐" },
            { label: "Vercel Edge", c: "#00c8b0", icon: "▲" },
            { label: "Next.js SSR", c: "#00e5a0", icon: "⬡" },
            { label: "Redis TTL", c: "#f5c518", icon: "⚡" },
            { label: "FastAPI", c: "#a78bfa", icon: "🐍" },
            { label: "PostgreSQL", c: "#00e5a0", icon: "🐘" },
            { label: "Grafana", c: "#ff7a50", icon: "📊" },
          ].map((n, i, arr) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ padding: "8px 14px", borderRadius: 9, background: `${n.c}18`, border: `1px solid ${n.c}33`, color: n.c, fontSize: 11, display: "flex", gap: 6, alignItems: "center" }}>
                <span>{n.icon}</span><span>{n.label}</span>
              </div>
              {i < arr.length - 1 && <span style={{ color: "#2a4060" }}>→</span>}
            </div>
          ))}
        </div>
        {/* Deploy steps */}
        <div style={{ fontSize: 9, letterSpacing: 3, color: "#3a5070", marginBottom: 14 }}>IMPLEMENTATION STEPS</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {DEPLOY_STEPS.map(s => (
            <div key={s.n} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "12px", background: "#000000", borderRadius: 10, border: "1px solid #1a1a1a" }}>
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "#00e5a0", flexShrink: 0, fontWeight: 700 }}>{s.n}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: "#a0c0d8", fontWeight: 600, marginBottom: 4 }}>{s.title}</div>
                <div style={{ fontSize: 11, color: "#4a6080", marginBottom: 6, lineHeight: 1.5 }}>{s.desc}</div>
                <code style={{ fontSize: 10, color: "#f5c518", background: "#0d172288", padding: "3px 8px", borderRadius: 4, fontFamily: "monospace" }}>{s.cmd}</code>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── MODALS ───────────────────────────────────────────────────────────────────
function WarnModal({ remaining, onExtend, onLogout }) {
  const c = remaining <= 10 ? "#ff4d4d" : "#f5c518";
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.93)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(10px)", animation: "fadeIn .3s ease" }}>
      <div style={{ background: "linear-gradient(140deg,#050505,#111111)", border: `1px solid ${c}44`, borderRadius: 20, padding: "40px 44px", maxWidth: 420, width: "90%", textAlign: "center", boxShadow: `0 0 60px ${c}22,0 24px 64px #00000099`, animation: "slideUp .4s cubic-bezier(.34,1.56,.64,1)" }}>
        <div style={{ fontSize: 44, marginBottom: 18, filter: `drop-shadow(0 0 14px ${c})`, animation: "pulse-icon 1s ease-in-out infinite alternate" }}>⚠</div>
        <div style={{ fontSize: 10, letterSpacing: 4, color: c, marginBottom: 8 }}>SESSION EXPIRING</div>
        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 26, fontWeight: 800, color: "#f0f6ff", marginBottom: 10 }}>Still working?</div>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 42, fontWeight: 700, color: c, margin: "8px 0 18px", filter: `drop-shadow(0 0 10px ${c}88)`, animation: remaining <= 10 ? "blink .6s infinite" : "none" }}>{fmt(remaining)}</div>
        <p style={{ color: "#4a6080", fontSize: 13, marginBottom: 26, lineHeight: 1.7 }}>Inactivity detected. Your session will close to protect your transactions.</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button onClick={onLogout} style={{ padding: "11px 22px", borderRadius: 9, border: "1px solid #1a1a1a", background: "transparent", color: "#666", fontSize: 12, cursor: "pointer", letterSpacing: 1 }}>Logout</button>
          <button onClick={onExtend} style={{ padding: "11px 26px", borderRadius: 9, border: "none", background: "linear-gradient(135deg,#00e5a0,#00c8b0)", color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer", letterSpacing: 1, boxShadow: "0 4px 18px #00e5a044" }}>Stay Logged In →</button>
        </div>
      </div>
    </div>
  );
}

function LogoutModal({ onLogin }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.97)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(14px)", animation: "fadeIn .4s ease" }}>
      <div style={{ textAlign: "center", maxWidth: 400, padding: "0 20px", animation: "slideUp .5s cubic-bezier(.34,1.56,.64,1)" }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#050505", border: "2px solid #ff4d4d44", margin: "0 auto 22px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, boxShadow: "0 0 36px #ff4d4d22" }}>🔒</div>
        <div style={{ fontSize: 9, letterSpacing: 5, color: "#ff4d4d", marginBottom: 10 }}>SESSION TERMINATED</div>
        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 26, fontWeight: 800, color: "#f0f6ff", marginBottom: 14, lineHeight: 1.2 }}>Securely logged out</div>
        <p style={{ color: "#777", fontSize: 13, lineHeight: 1.8, marginBottom: 24 }}>Session closed due to inactivity.<br />All transactions saved. Audit log retained.</p>
        <div style={{ background: "#11111188", border: "1px solid #1a1a1a", borderRadius: 12, padding: "14px 18px", marginBottom: 24, textAlign: "left" }}>
          {[["Duration", "47m 32s"], ["Last Activity", "09:42:11"], ["Transactions", "5 cleared"], ["Behaviour Score", "91 / 100"], ["Anomalies", "0 detected"]].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
              <span style={{ fontSize: 11, color: "#3a5070" }}>{k}</span>
              <span style={{ fontSize: 11, color: "#00e5a0", fontFamily: "monospace" }}>{v}</span>
            </div>
          ))}
        </div>
        <button onClick={onLogin} style={{ width: "100%", padding: "13px", borderRadius: 11, border: "none", background: "linear-gradient(135deg,#00e5a0,#00c8b0)", color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer", letterSpacing: 1, boxShadow: "0 4px 22px #00e5a044" }}>Sign In Again →</button>
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function App() {
  // Pull all state from the real SessionProvider context
  let session;
  try {
    const { useSessionEngine } = require("./SessionProvider");
    session = useSessionEngine();
  } catch {
    session = null;
  }

  const [view, setView] = useState("dashboard");
  const [scrub, setScrub] = useState(100);
  const [loggedOut, setLoggedOut] = useState(false);

  // Use context values if available, otherwise fall back to local simulation
  const remaining = session?.remaining ?? BASE_TIMEOUT;
  const showWarn = session?.showWarning ?? false;
  const trustScore = session?.biometricScore ?? 91;
  const mouseVel = session?.mouseVelocity ?? 82;
  const keystroke = session?.keystrokeRhythm ?? 88;
  const scrollPat = session?.scrollPattern ?? 79;
  const riskLevel = session?.riskLevel ?? "MEDIUM";
  const adaptedTimeout = session?.adaptedTimeout ?? 75;
  const tabs = session?.tabs ?? TABS_DATA;
  const riskFactors = (session?.riskFactors?.length > 0) ? session.riskFactors : [
    { label: "High-value TXN (>₹4L)", impact: "+", delta: 30 },
    { label: "Trusted device registered", impact: "-", delta: 45 },
    { label: "Unusual time-of-day", impact: "+", delta: 10 },
    { label: "Normal geo-location", impact: "-", delta: 20 },
  ];

  // Map session logs to the format the UI expects
  const logs = session?.sessionLog?.map(l => ({ t: l.time, msg: l.msg, type: l.type })) ?? INIT_LOGS;

  const extend = session?.extend ?? (() => { });
  const killTab = session?.killTab ?? (() => { });
  const logout = session?.logout ?? (() => { });

  const warn = remaining <= WARN_AT && remaining > 10, crit = remaining <= 10;
  const tc = crit ? "#ff4d4d" : warn ? "#f5c518" : "#00e5a0";

  if (loggedOut) return <LogoutModal onLogin={() => { setLoggedOut(false); window.location.href = "/dashboard"; }} />;

  const NAV_VIEWS = [
    { id: "dashboard", label: "Live Dashboard" },
    { id: "compare", label: "VS Competitors" },
    { id: "techstack", label: "Tech Stack & Deploy" },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        body{background:#000000;font-family:'Syne',sans-serif;}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-track{background:#050505;}
        ::-webkit-scrollbar-thumb{background:#1a1a1a;border-radius:2px;}
        
        /* Premium OLED Animations */
        @keyframes ping{0%{transform:scale(1);opacity:.8}100%{transform:scale(2.4);opacity:0}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes slideUp{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse-icon{from{transform:scale(1)}to{transform:scale(1.09)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.2}}
        @keyframes scanline { 0% { transform: translateY(-100%); opacity: 0; } 50% { opacity: 0.1; } 100% { transform: translateY(100vh); opacity: 0; } }
        @keyframes gradientShift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        @keyframes subtleFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }

        .vnav-btn{background:none;border:none;cursor:pointer;padding:8px 18px;border-radius:8px;font-family:'Syne',sans-serif;font-size:11px;letter-spacing:1.5px;transition:all .2s;white-space:nowrap;}
        .vnav-btn.on{background:#111111;color:#00e5a0;box-shadow: 0 0 15px #00e5a011;}
        .vnav-btn.off{color:#444444;}
        .vnav-btn.off:hover{color:#777777;text-shadow: 0 0 8px #ffffff33;}
      `}</style>

      {/* OLED Scanline Overlay */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none", zIndex: 9999, background: "linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.2) 51%)", backgroundSize: "100% 4px", opacity: 0.15 }}></div>
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: "100px", background: "linear-gradient(to bottom, transparent, #00e5a011, transparent)", animation: "scanline 8s linear infinite", pointerEvents: "none", zIndex: 9998 }}></div>

      {showWarn && <WarnModal remaining={remaining} onExtend={extend} onLogout={logout} />}

      <div style={{ minHeight: "100vh", background: "#000000", color: "#f0f6ff", paddingBottom: 48, position: "relative" }}>

        {/* NAV */}
        <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px", height: 58, background: "rgba(0,0,0,0.8)", borderBottom: "1px solid #1a1a1a", backdropFilter: "blur(14px)", position: "sticky", top: 0, zIndex: 100 }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(270deg,#00e5a0,#0088ff,#00e5a0)", backgroundSize: "200% 200%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#000", fontWeight: 800, animation: "gradientShift 4s ease infinite", boxShadow: "0 0 15px #00e5a044" }}>⬡</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: "#f0f6ff" }}>NEXUS TLS</div>
              <div style={{ fontSize: 8, color: "#2a4060", letterSpacing: 2 }}>SECURE SESSION v2</div>
            </div>
          </div>

          {/* View switcher */}
          <div style={{ display: "flex", gap: 3, background: "#050505", borderRadius: 10, padding: "3px", border: "1px solid #1a1a1a" }}>
            {NAV_VIEWS.map(v => (
              <button key={v.id} className={`vnav-btn ${view === v.id ? "on" : "off"}`} onClick={() => setView(v.id)}>{v.label}</button>
            ))}
          </div>

          {/* Session strip */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 14px", background: "#000000", border: `1px solid ${tc}55`, borderRadius: 20, transition: "border-color .4s", boxShadow: `0 0 15px ${tc}11` }}>
              <Dot c={tc} pulse />
              <span style={{ fontSize: 9, color: "#555555", letterSpacing: 2 }}>SESSION</span>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, fontWeight: 700, color: tc, transition: "color .4s", animation: crit ? "blink .6s infinite" : "none" }}>{fmt(remaining)}</span>
              <button onClick={extend} style={{ background: `${tc}11`, border: `1px solid ${tc}33`, color: tc, borderRadius: 5, padding: "2px 9px", fontSize: 8, letterSpacing: 1.5, cursor: "pointer", fontFamily: "'Syne',sans-serif", transition: "all .2s" }}>EXTEND</button>
            </div>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#050505", border: "1px solid #1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>👤</div>
          </div>
        </nav>

        <div style={{ padding: "24px 28px", maxWidth: 1440, margin: "0 auto" }}>

          {/* ══ DASHBOARD ══ */}
          {view === "dashboard" && (
            <div style={{ animation: "fadeIn .4s ease" }}>
              {/* Innovation badge row */}
              <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", animation: "subtleFloat 6s ease-in-out infinite" }}>
                {[
                  ["🧬 Behavioural Biometrics", "#a78bfa"],
                  ["⬟ Risk-Adaptive Timeout", "#f5c518"],
                  ["⬡ Cross-Tab Kill Switch", "#00c8b0"],
                  ["◈ Session Replay Timeline", "#00e5a0"],
                  ["🗺 Geo-Fence Device Trust", "#ff7a50"],
                ].map(([l, c]) => (
                  <div key={l} style={{ padding: "5px 14px", borderRadius: 20, background: `${c}0a`, border: `1px solid ${c}22`, fontSize: 10, color: c, letterSpacing: .5 }}>{l}</div>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "290px 1fr", gap: 18 }}>
                {/* LEFT */}
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {/* Ring */}
                  <div style={{ background: "linear-gradient(180deg,#050505,#000000)", border: `1px solid ${tc}22`, borderRadius: 14, padding: "20px", textAlign: "center", transition: "all .4s", boxShadow: `0 0 40px ${tc}0a` }}>
                    <div style={{ fontSize: 8, letterSpacing: 3, color: "#555", marginBottom: 12 }}>SESSION INTEGRITY</div>
                    <RingTimer remaining={remaining} total={BASE_TIMEOUT} warn={warn} crit={crit} />
                    <div style={{ marginTop: 12, display: "flex", justifyContent: "space-around" }}>
                      {[["BASE", fmt(BASE_TIMEOUT)], ["ADAPTED", fmt(adaptedTimeout)], ["WARN", fmt(WARN_AT)]].map(([k, v]) => (
                        <div key={k} style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 7, color: "#444", letterSpacing: 1.5, marginBottom: 3 }}>{k}</div>
                          <div style={{ fontFamily: "monospace", fontSize: 11, color: "#777" }}>{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <BiometricsPanel trustScore={trustScore} mouseVel={mouseVel} keystrokeRhythm={keystroke} scrollPattern={scrollPat} />

                  {/* Policies */}
                  <div style={{ background: "#0a1520", border: "1px solid #1e2d45", borderRadius: 14, padding: "18px" }}>
                    <div style={{ fontSize: 8, letterSpacing: 3, color: "#3a5070", marginBottom: 12 }}>SESSION POLICIES</div>
                    <Pill label="Base Timeout" val="2:00" c="#00e5a0" />
                    <Pill label="Adapted Timeout" val="1:15" c="#f5c518" />
                    <Pill label="Warning Window" val="30s" c="#f5c518" />
                    <Pill label="JWT Rotation" val="5 min" c="#00c8b0" />
                    <Pill label="Max Session" val="4 hours" c="#00e5a0" />
                    <Pill label="Biometric Drop Threshold" val="<60" c="#a78bfa" />
                    <Pill label="Concurrent Tabs" val="Tracked" c="#00c8b0" />
                    <Pill label="Geo Fence Radius" val="50 km" c="#ff7a50" />
                  </div>
                </div>

                {/* RIGHT */}
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {/* Stat chips */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
                    {[
                      { l: "Trust Score", v: `${trustScore}`, sub: "biometric", c: "#a78bfa" },
                      { l: "Transactions", v: "5", sub: "this session", c: "#00e5a0" },
                      { l: "Active Tabs", v: `${tabs.length}`, sub: "monitored", c: "#00c8b0" },
                      { l: "Threats", v: "0", sub: "detected", c: "#00e5a0" },
                    ].map(s => (
                      <div key={s.l} style={{ background: "#0a1520", border: `1px solid ${s.c}22`, borderRadius: 12, padding: "14px 16px" }}>
                        <div style={{ fontSize: 24, fontWeight: 800, color: s.c, fontFamily: "'JetBrains Mono',monospace", marginBottom: 2 }}>{s.v}</div>
                        <div style={{ fontSize: 9, color: "#3a5070", letterSpacing: 1 }}>{s.l.toUpperCase()}</div>
                        <div style={{ fontSize: 8, color: "#2a4060", marginTop: 3 }}>{s.sub}</div>
                      </div>
                    ))}
                  </div>

                  {/* Risk Adaptive + Cross-Tab side by side */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <RiskAdaptivePanel riskLevel={riskLevel} adaptedTimeout={adaptedTimeout} baseTimeout={BASE_TIMEOUT} factors={riskFactors} />
                    <CrossTabPanel tabs={tabs} onKillTab={killTab} />
                  </div>

                  {/* Replay timeline */}
                  <ReplayTimeline events={INIT_TIMELINE} scrub={scrub} onScrub={setScrub} />

                  {/* Geo map */}
                  <GeoFenceMap threatLevel="CLEAR" />

                  {/* Transactions table */}
                  <div style={{ background: "#0a1520", border: "1px solid #1e2d45", borderRadius: 14, overflow: "hidden" }}>
                    <div style={{ padding: "12px 16px", borderBottom: "1px solid #1e2d45", fontSize: 8, letterSpacing: 3, color: "#3a5070" }}>LIVE TRANSACTIONS</div>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid #1e2d4544" }}>
                          {["TXN ID", "TYPE", "ROUTE", "AMOUNT", "RISK", "STATUS"].map(h => (
                            <th key={h} style={{ padding: "8px 14px", textAlign: "left", fontSize: 8, letterSpacing: 2, color: "#2a4060" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {TXNS.map((t, i) => (
                          <tr key={t.id} style={{ borderBottom: "1px solid #1e2d4522", background: i % 2 ? "transparent" : "#060d1a" }}>
                            <td style={{ padding: "9px 14px", fontFamily: "monospace", fontSize: 11, color: "#00e5a0" }}>{t.id}</td>
                            <td style={{ padding: "9px 14px", fontSize: 11, color: "#7a9ab0" }}>{t.type}</td>
                            <td style={{ padding: "9px 14px", fontFamily: "monospace", fontSize: 10, color: "#4a6080" }}>{t.route}</td>
                            <td style={{ padding: "9px 14px", fontFamily: "monospace", fontSize: 11, color: "#f0f6ff", fontWeight: 600 }}>{t.amount}</td>
                            <td style={{ padding: "9px 14px" }}><Tag c={RISK_C[t.risk]}>{t.risk}</Tag></td>
                            <td style={{ padding: "9px 14px", fontSize: 10, color: STAT_C[t.status], fontFamily: "monospace" }}>● {t.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Session log */}
                  <div style={{ background: "#0a1520", border: "1px solid #1e2d45", borderRadius: 14, padding: "16px" }}>
                    <div style={{ fontSize: 8, letterSpacing: 3, color: "#3a5070", marginBottom: 12 }}>SESSION AUDIT LOG</div>
                    {logs.map((l, i) => {
                      const c = l.type === "success" ? "#00e5a0" : l.type === "warn" ? "#f5c518" : "#4a6080";
                      return (
                        <div key={i} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: "1px solid #1e2d4522", alignItems: "center" }}>
                          <span style={{ fontFamily: "monospace", fontSize: 9, color: "#2a4060", flexShrink: 0 }}>{l.t}</span>
                          <Tag c={c}>{l.type.toUpperCase()}</Tag>
                          <span style={{ fontSize: 11, color: "#5a7a9a" }}>{l.msg}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ COMPARISON ══ */}
          {view === "compare" && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: "#f0f6ff", marginBottom: 6 }}>NEXUS TLS vs Industry Solutions</h2>
                <p style={{ fontSize: 13, color: "#4a6080", lineHeight: 1.7 }}>Comparing session management capabilities across the leading identity & access management platforms. NEXUS TLS is the only solution combining domain-specific logistics rules, live behavioural biometrics, and risk-adaptive timeouts in a single platform.</p>
              </div>

              {/* Score cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, marginBottom: 20 }}>
                {[
                  { name: "NEXUS TLS", score: 10, c: "#00e5a0", label: "Our Solution" },
                  { name: "Okta", score: 7, c: "#f5c518", label: "Industry Leader" },
                  { name: "Azure AD", score: 7, c: "#f5c518", label: "Enterprise" },
                  { name: "Ping ID", score: 6, c: "#f5c518", label: "Enterprise" },
                  { name: "AWS Cognito", score: 5, c: "#5a7a9a", label: "Cloud Native" },
                ].map(s => (
                  <div key={s.name} style={{ background: "#050505", border: `1px solid ${s.c}33`, borderRadius: 12, padding: "16px", textAlign: "center", boxShadow: `inset 0 0 15px ${s.c}0a` }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: s.c, fontFamily: "'JetBrains Mono',monospace", marginBottom: 2 }}>{s.score}<span style={{ fontSize: 14, color: "#555" }}>/10</span></div>
                    <div style={{ fontSize: 12, color: "#a0c0d8", fontWeight: 600, marginBottom: 3 }}>{s.name}</div>
                    <div style={{ fontSize: 9, color: "#555" }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Differentiators */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
                {[
                  { title: "Only in NEXUS TLS", icon: "✦", c: "#00e5a0", items: ["Risk-Adaptive Timeout (real-time)", "Behavioral Biometrics Engine", "Cross-Tab Kill Switch", "Logistics Domain Rules (TXN value)", "Session Replay Scrubber"] },
                  { title: "Available in others too", icon: "◈", c: "#f5c518", items: ["Inactivity Timeout (fixed)", "JWT Token Rotation", "2FA / MFA Support", "Audit Log", "Warning Modal"] },
                  { title: "Not in any competitor", icon: "⬡", c: "#a78bfa", items: ["Geo-fence + Anomaly Rings", "Live Biometric Trust Score", "Tab-level Session Visibility", "Logistics-Risk Timeout Rules", "In-browser ML Inference"] },
                ].map(col => (
                  <div key={col.title} style={{ background: "#050505", border: `1px solid ${col.c}22`, borderRadius: 13, padding: "18px" }}>
                    <div style={{ display: "flex", gap: 7, alignItems: "center", marginBottom: 14 }}>
                      <span style={{ color: col.c, fontSize: 14 }}>{col.icon}</span>
                      <span style={{ fontSize: 11, color: col.c, fontWeight: 700 }}>{col.title}</span>
                    </div>
                    {col.items.map(item => (
                      <div key={item} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "flex-start" }}>
                        <span style={{ color: col.c, fontSize: 8, marginTop: 4, flexShrink: 0 }}>◆</span>
                        <span style={{ fontSize: 12, color: "#777", lineHeight: 1.5 }}>{item}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Main table */}
              <div style={{ background: "#050505", border: "1px solid #1a1a1a", borderRadius: 14, overflow: "hidden" }}>
                <div style={{ padding: "14px 16px", borderBottom: "1px solid #1a1a1a", fontSize: 8, letterSpacing: 3, color: "#555" }}>FEATURE COMPARISON MATRIX</div>
                <ComparisonTable />
              </div>
            </div>
          )}

          {/* ══ TECH STACK ══ */}
          {view === "techstack" && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: "#f0f6ff", marginBottom: 6 }}>Tech Stack & Deployment</h2>
                <p style={{ fontSize: 13, color: "#4a6080", lineHeight: 1.7 }}>Production-ready implementation using modern, open-source tools. Estimated build time: 6–8 weeks for a team of 3 engineers. Monthly infra cost at 1,000 concurrent users: ~$120/month.</p>
              </div>
              <TechStackView />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
