// components/session/ServerAdminDashboard.jsx
// ─── SERVER-SIDE MONITORING DASHBOARD ─────────────────────────────────────────
// This dashboard is shown ONLY on the server machine (NEXT_PUBLIC_IS_SERVER=true).
// No session timers, no extend buttons — purely a monitoring view of all
// connected clients and their activities.
"use client";

import React, { useState, useEffect } from "react";
import { useSessionEngine } from "./SessionProvider";

const Tag = ({ c, children }) => (
    <span style={{
        background: `${c}15`, border: `1px solid ${c}33`, color: c, padding: "3px 8px",
        borderRadius: 6, fontSize: 9, fontWeight: 700, letterSpacing: 1, fontFamily: "'JetBrains Mono',monospace",
    }}>{children}</span>
);

const Dot = ({ c, pulse }) => (
    <span style={{
        width: 6, height: 6, borderRadius: "50%", background: c, display: "inline-block",
        boxShadow: `0 0 10px ${c}`, animation: pulse ? "ping 1.5s ease-out infinite" : "none"
    }} />
);

// ─── EVENT METADATA ────────────────────────────────────────────────────────────
const EVENT_META = {
    tab_open: { icon: "🔓", label: "Tab Opened", color: "#00e5a0" },
    tab_close: { icon: "✖", label: "Tab Closed", color: "#ff4d4d" },
    tab_visibility: { icon: "👁", label: "Visibility", color: "#00c8b0" },
    tab_focus: { icon: "🎯", label: "Window Focus", color: "#00e5a0" },
    tab_blur: { icon: "💨", label: "Window Blur", color: "#f5c518" },
    tab_idle: { icon: "💤", label: "Tab Idle", color: "#ff4d4d" },
    tab_active: { icon: "⚡", label: "Tab Active", color: "#00e5a0" },
    page_change: { icon: "🔀", label: "Page Nav", color: "#a78bfa" },
};

// ─── CONNECTED CLIENTS PANEL ──────────────────────────────────────────────────
function ConnectedClientsPanel({ tabs }) {
    const activeCount = tabs.filter(t => t.visible !== false && !t.idle).length;
    const hiddenCount = tabs.filter(t => t.visible === false).length;
    const idleCount = tabs.filter(t => t.idle).length;

    return (
        <div style={{
            background: "rgba(10,21,32,0.6)", backdropFilter: "blur(12px)",
            border: "1px solid #1e2d45", borderRadius: 14, padding: "20px",
            display: "flex", flexDirection: "column",
        }}>
            <div style={{ fontSize: 9, letterSpacing: 3, color: "#555", marginBottom: 16 }}>CONNECTED CLIENTS</div>

            {/* Summary stats */}
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                {[
                    { label: "ACTIVE", val: activeCount, c: "#00e5a0" },
                    { label: "HIDDEN", val: hiddenCount, c: "#f5c518" },
                    { label: "IDLE", val: idleCount, c: "#ff4d4d" },
                    { label: "TOTAL", val: tabs.length, c: "#0088ff" },
                ].map(s => (
                    <div key={s.label} style={{
                        flex: 1, textAlign: "center", background: `${s.c}0a`,
                        border: `1px solid ${s.c}22`, borderRadius: 10, padding: "12px 8px",
                    }}>
                        <div style={{ fontSize: 28, fontWeight: 900, color: s.c, fontFamily: "'JetBrains Mono',monospace", lineHeight: 1 }}>{s.val}</div>
                        <div style={{ fontSize: 8, color: s.c, letterSpacing: 2, marginTop: 6 }}>{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Client detail list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 300, overflowY: "auto" }}>
                {tabs.length === 0 && (
                    <div style={{ textAlign: "center", color: "#3a5070", padding: 20 }}>
                        <div style={{ fontSize: 28, opacity: 0.3, marginBottom: 8 }}>📡</div>
                        <div style={{ fontSize: 11 }}>No clients connected</div>
                        <div style={{ fontSize: 9, color: "#2a4060", marginTop: 4 }}>Waiting for client connections...</div>
                    </div>
                )}
                {tabs.map(tab => {
                    const isHidden = tab.visible === false;
                    const isIdle = tab.idle;
                    const c = isIdle ? "#ff4d4d" : isHidden ? "#f5c518" : "#00e5a0";
                    const status = isIdle ? "IDLE" : isHidden ? "HIDDEN" : tab.focused ? "FOCUSED" : "VISIBLE";

                    return (
                        <div key={tab.id} style={{
                            display: "flex", alignItems: "center", gap: 10,
                            padding: "10px 14px", background: `${c}08`,
                            border: `1px solid ${c}18`, borderRadius: 10,
                        }}>
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: c, boxShadow: `0 0 8px ${c}`, flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontSize: 11, color: "#fff", fontWeight: 600 }}>{tab.title || "Untitled Tab"}</span>
                                    <Tag c={c}>{status}</Tag>
                                </div>
                                <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                                    <span style={{ fontSize: 9, color: "#5a7a9a" }}>Route: <span style={{ color: "#7a9ab0", fontFamily: "monospace" }}>{tab.route || "/"}</span></span>
                                    <span style={{ fontSize: 9, color: "#3a5070", fontFamily: "monospace" }}>tab:{tab.id?.slice(0, 8) || "?"}...</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── ACTIVITY FEED (full-width server version) ────────────────────────────────
function ServerActivityFeed({ activities }) {
    return (
        <div style={{
            background: "rgba(10,21,32,0.6)", backdropFilter: "blur(12px)",
            border: "1px solid #1e2d45", borderRadius: 14, padding: "20px",
            display: "flex", flexDirection: "column", minHeight: 400,
        }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 18 }}>📡</span>
                    <span style={{ fontSize: 9, letterSpacing: 3, color: "#555" }}>CLIENT ACTIVITY FEED</span>
                    {activities.length > 0 && (
                        <span style={{ background: "#00e5a0", color: "#000", fontSize: 10, fontWeight: 800, borderRadius: 10, padding: "2px 8px", fontFamily: "monospace" }}>{activities.length}</span>
                    )}
                </div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#00e5a0", animation: "ping 1.5s ease-out infinite" }} />
                    <span style={{ fontSize: 8, color: "#00e5a0", fontFamily: "monospace", letterSpacing: 1 }}>LIVE STREAM</span>
                </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                {activities.length === 0 && (
                    <div style={{ textAlign: "center", color: "#3a5070", padding: 40 }}>
                        <div style={{ fontSize: 36, opacity: 0.3, marginBottom: 12 }}>📡</div>
                        <div style={{ fontSize: 13, color: "#4a6080" }}>Waiting for client events...</div>
                        <div style={{ fontSize: 10, color: "#3a5070", marginTop: 6 }}>Events will appear here when clients interact with the system</div>
                    </div>
                )}
                {activities.map((act, i) => {
                    const meta = EVENT_META[act.event] || { icon: "•", label: act.event, color: "#5a7a9a" };
                    return (
                        <div key={i} style={{
                            display: "flex", gap: 10, alignItems: "flex-start",
                            padding: "10px 14px",
                            background: i === 0 ? `${meta.color}0d` : "transparent",
                            border: `1px solid ${i === 0 ? meta.color + "22" : "transparent"}`,
                            borderRadius: 10,
                            animation: i === 0 ? "slideDown 0.3s ease-out" : "none",
                            transition: "all 0.3s",
                        }}>
                            <span style={{ fontSize: 16, flexShrink: 0 }}>{meta.icon}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: 10, color: meta.color, fontWeight: 700, letterSpacing: 1 }}>{meta.label.toUpperCase()}</span>
                                    <span style={{ fontSize: 9, color: "#3a5070", fontFamily: "monospace", flexShrink: 0 }}>{act.time}</span>
                                </div>
                                <div style={{ fontSize: 11, color: "#8aa0b8", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {act.detail}
                                </div>
                                <div style={{ fontSize: 8, color: "#2a3d55", fontFamily: "monospace", marginTop: 2 }}>
                                    tab:{act.tabId?.slice(0, 8) || "?"}...
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── SYSTEM STATUS PANEL ──────────────────────────────────────────────────────
function SystemStatusPanel({ stats, wsConnected }) {
    const serverUptime = new Date().toLocaleTimeString();
    return (
        <div style={{
            background: "rgba(10,21,32,0.6)", backdropFilter: "blur(12px)",
            border: "1px solid #1e2d45", borderRadius: 14, padding: "20px",
        }}>
            <div style={{ fontSize: 9, letterSpacing: 3, color: "#555", marginBottom: 16 }}>SYSTEM STATUS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                    { icon: "🟢", label: "Server Status", value: "ONLINE", c: "#00e5a0" },
                    { icon: "📊", label: "Uptime", value: `${stats.uptime}%`, c: "#00e5a0" },
                    { icon: "🔗", label: "Active Sessions", value: String(stats.activeSessions), c: "#0088ff" },
                    { icon: "🔒", label: "Avg Trust Score", value: String(stats.avgTrustScore), c: "#00e5a0" },
                    { icon: "⚡", label: "P95 Latency", value: `${stats.p95Latency}ms`, c: stats.p95Latency > 50 ? "#f5c518" : "#00e5a0" },
                    { icon: "🛡️", label: "Blocked Threats", value: String(stats.blockedThreats), c: stats.blockedThreats > 0 ? "#ff4d4d" : "#00e5a0" },
                    { icon: "🌐", label: "WebSocket", value: wsConnected ? "CONNECTED" : "DISCONNECTED", c: wsConnected ? "#00e5a0" : "#ff4d4d" },
                    { icon: "⏰", label: "Server Time", value: serverUptime, c: "#7a9ab0" },
                ].map(m => (
                    <div key={m.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid #1e2d4522" }}>
                        <span style={{ fontSize: 14 }}>{m.icon}</span>
                        <span style={{ fontSize: 9, color: "#5a7a9a", flex: 1, letterSpacing: 1 }}>{m.label}</span>
                        <span style={{ fontSize: 11, color: m.c, fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>{m.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── THREAT SUMMARY PANEL ─────────────────────────────────────────────────────
function ThreatSummaryPanel({ threats }) {
    const critCount = threats.filter(t => t.level === "CRITICAL" || t.level === "HIGH").length;
    const warnCount = threats.filter(t => t.level === "MEDIUM" || t.level === "WARNING").length;
    const totalBlocked = threats.length;

    return (
        <div style={{
            background: "rgba(10,21,32,0.6)", backdropFilter: "blur(12px)",
            border: "1px solid #1e2d45", borderRadius: 14, padding: "20px",
        }}>
            <div style={{ fontSize: 9, letterSpacing: 3, color: "#555", marginBottom: 16 }}>THREAT OVERVIEW</div>

            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1, textAlign: "center", background: "#ff4d4d0a", border: "1px solid #ff4d4d22", borderRadius: 10, padding: "12px" }}>
                    <div style={{ fontSize: 24, fontWeight: 900, color: "#ff4d4d", fontFamily: "monospace" }}>{critCount}</div>
                    <div style={{ fontSize: 8, color: "#ff4d4d", letterSpacing: 2, marginTop: 4 }}>CRITICAL</div>
                </div>
                <div style={{ flex: 1, textAlign: "center", background: "#f5c5180a", border: "1px solid #f5c51822", borderRadius: 10, padding: "12px" }}>
                    <div style={{ fontSize: 24, fontWeight: 900, color: "#f5c518", fontFamily: "monospace" }}>{warnCount}</div>
                    <div style={{ fontSize: 8, color: "#f5c518", letterSpacing: 2, marginTop: 4 }}>WARNING</div>
                </div>
                <div style={{ flex: 1, textAlign: "center", background: "#0088ff0a", border: "1px solid #0088ff22", borderRadius: 10, padding: "12px" }}>
                    <div style={{ fontSize: 24, fontWeight: 900, color: "#0088ff", fontFamily: "monospace" }}>{totalBlocked}</div>
                    <div style={{ fontSize: 8, color: "#0088ff", letterSpacing: 2, marginTop: 4 }}>TOTAL</div>
                </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 200, overflowY: "auto" }}>
                {threats.length === 0 && (
                    <div style={{ textAlign: "center", padding: 16, color: "#3a5070", fontSize: 11 }}>No threats detected</div>
                )}
                {threats.slice(0, 10).map((t, i) => {
                    const tc = t.level === "CRITICAL" || t.level === "HIGH" ? "#ff4d4d" : t.level === "MEDIUM" ? "#f5c518" : "#00e5a0";
                    return (
                        <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 10px", background: `${tc}08`, border: `1px solid ${tc}15`, borderRadius: 8 }}>
                            <div style={{ width: 5, height: 5, borderRadius: "50%", background: tc }} />
                            <span style={{ fontSize: 10, color: "#8aa0b8", flex: 1 }}>{t.message || t.label || "Threat detected"}</span>
                            <Tag c={tc}>{t.level}</Tag>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── SERVER ADMIN DASHBOARD ───────────────────────────────────────────────────
export default function ServerAdminDashboard() {
    let session = null;
    try {
        session = useSessionEngine();
    } catch (e) {
        console.warn("[ServerAdmin] SessionProvider not available", e);
    }

    const wsConnected = session?.wsConnected ?? false;
    const stats = session?.systemStats ?? { uptime: 99.97, activeSessions: 0, avgTrustScore: 0, p95Latency: 0, blockedThreats: 0 };
    const threats = session?.threats ?? [];
    const tabs = session?.tabs ?? [];
    const clientActivities = session?.clientActivities ?? [];
    const sessionLog = session?.sessionLog ?? [];
    const logout = session?.logout ?? (() => { });

    const [clock, setClock] = useState(new Date().toLocaleTimeString());
    useEffect(() => {
        const t = setInterval(() => setClock(new Date().toLocaleTimeString()), 1000);
        return () => clearInterval(t);
    }, []);

    return (
        <>
            <style>{`
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500;700;800&display=swap');
*,*::before,*::after{ box-sizing: border-box; margin: 0; padding: 0; }
body{ background:#000000; font-family: 'Syne', sans-serif; overflow-x: hidden; }
::-webkit-scrollbar{ width: 6px; height: 6px; }
::-webkit-scrollbar-track{ background:#050910; }
::-webkit-scrollbar-thumb{ background:#1e2d45; border-radius: 3px; }
@keyframes ping{ 0%{transform:scale(1);opacity:.8}100%{transform:scale(2.4);opacity:0} }
@keyframes scanline{0%{transform:translateY(-100%);opacity:0}50%{opacity:0.1}100%{transform:translateY(100vh);opacity:0}}
@keyframes gridMove{0%{background-position:0 0}100%{background-position:50px 50px}}
@keyframes slideDown{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}
@keyframes orbFloat1{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(10vw,15vh) scale(1.1)}}
@keyframes orbFloat2{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-10vw,-15vh) scale(1.1)}}
@keyframes staggerSlideUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
@keyframes staggerScaleIn{from{opacity:0;transform:scale(0.95)}to{opacity:1;transform:scale(1)}}
.anim-panel{opacity:0;animation-fill-mode:forwards;animation-timing-function:cubic-bezier(0.2,0.8,0.2,1)}
.anim-slide-up{animation-name:staggerSlideUp;animation-duration:.7s}
.anim-scale-in{animation-name:staggerScaleIn;animation-duration:.7s}
.d0{animation-delay:0s}.d1{animation-delay:.1s}.d2{animation-delay:.2s}
.d3{animation-delay:.3s}.d4{animation-delay:.4s}.d5{animation-delay:.5s}
      `}</style>

            {/* Background */}
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none", zIndex: 0, background: "radial-gradient(ellipse at top, #0a1120 0%, #000000 70%)" }} />
            <div style={{ position: "fixed", inset: 0, zIndex: 0, backgroundImage: "linear-gradient(rgba(0, 229, 160, 0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 229, 160, 0.02) 1px, transparent 1px)", backgroundSize: "40px 40px", animation: "gridMove 20s linear infinite", pointerEvents: "none" }} />
            <div style={{ position: "fixed", top: "-20%", left: "-10%", width: "50vw", height: "50vw", background: "radial-gradient(circle, rgba(0,229,160,0.05) 0%, rgba(0,0,0,0) 60%)", borderRadius: "50%", filter: "blur(80px)", animation: "orbFloat1 25s ease-in-out infinite alternate", pointerEvents: "none", zIndex: 0 }} />
            <div style={{ position: "fixed", bottom: "-20%", right: "-10%", width: "50vw", height: "50vw", background: "radial-gradient(circle, rgba(0,136,255,0.04) 0%, rgba(0,0,0,0) 60%)", borderRadius: "50%", filter: "blur(80px)", animation: "orbFloat2 30s ease-in-out infinite alternate", pointerEvents: "none", zIndex: 0 }} />
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: "100px", background: "linear-gradient(to bottom, transparent, rgba(0,229,160,0.05), transparent)", animation: "scanline 6s linear infinite", pointerEvents: "none", zIndex: 9998 }} />

            <div style={{ minHeight: "100vh", position: "relative", zIndex: 1, color: "#fff", display: "flex", flexDirection: "column" }}>

                {/* ─── NAV BAR (server version: no timer, no extend) ─── */}
                <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px", height: 64, background: "rgba(3,7,12,0.8)", borderBottom: "1px solid rgba(255,255,255,0.05)", backdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 100 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#ff4d4d,#ff8800)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "#000", fontWeight: 800, boxShadow: "0 0 20px rgba(255,77,77,0.3)" }}>⬡</div>
                        <div>
                            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: 1, color: "#fff" }}>NEXUS <span style={{ color: "#ff4d4d" }}>ADMIN</span></div>
                            <div style={{ fontSize: 8, color: "#5a7a9a", letterSpacing: 2 }}>SERVER CONTROL CENTER</div>
                        </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        {/* Connection status */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 14px", borderRadius: 20, background: wsConnected ? "rgba(0,229,160,0.08)" : "rgba(245,197,24,0.08)", border: `1px solid ${wsConnected ? "rgba(0,229,160,0.3)" : "rgba(245,197,24,0.3)"}` }}>
                            <Dot c={wsConnected ? "#00e5a0" : "#f5c518"} pulse={wsConnected} />
                            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: wsConnected ? "#00e5a0" : "#f5c518", fontFamily: "'JetBrains Mono',monospace" }}>{wsConnected ? "LIVE" : "OFFLINE"}</span>
                        </div>

                        {/* Connected clients count */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 14px", borderRadius: 20, background: "rgba(0,136,255,0.08)", border: "1px solid rgba(0,136,255,0.3)" }}>
                            <span style={{ fontSize: 12 }}>👤</span>
                            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: "#0088ff", fontFamily: "'JetBrains Mono',monospace" }}>{tabs.length} CLIENT{tabs.length !== 1 ? "S" : ""}</span>
                        </div>

                        {/* Server clock */}
                        <div style={{ padding: "5px 14px", borderRadius: 20, background: "rgba(0,0,0,0.5)", border: "1px solid #1e2d45" }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#7a9ab0", fontFamily: "'JetBrains Mono',monospace" }}>{clock}</span>
                        </div>

                        <button onClick={logout} style={{ background: "rgba(255,77,77,0.1)", border: "1px solid #ff4d4d33", color: "#ff4d4d", borderRadius: 8, padding: "6px 14px", fontSize: 9, fontWeight: 700, letterSpacing: 1, cursor: "pointer" }}>LOGOUT</button>
                    </div>
                </nav>

                {/* ─── EXECUTIVE STRIP ─── */}
                <div style={{ display: "flex", justifyContent: "center", gap: 32, padding: "12px 28px", background: "rgba(5,9,16,0.6)", borderBottom: "1px solid #1e2d4533" }}>
                    {[
                        { label: "SERVER UPTIME", val: `${stats.uptime}%`, c: "#00e5a0" },
                        { label: "ACTIVE SESSIONS", val: String(stats.activeSessions), c: "#0088ff" },
                        { label: "AVG TRUST SCORE", val: String(stats.avgTrustScore), c: "#00e5a0" },
                        { label: "P95 LATENCY", val: `${stats.p95Latency}ms`, c: stats.p95Latency > 50 ? "#f5c518" : "#00e5a0" },
                        { label: "BLOCKED THREATS", val: String(stats.blockedThreats), c: stats.blockedThreats > 0 ? "#ff4d4d" : "#00e5a0" },
                        { label: "CONNECTED TABS", val: String(tabs.length), c: "#0088ff" },
                    ].map(s => (
                        <div key={s.label} style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 8, letterSpacing: 2, color: "#555", marginBottom: 4 }}>{s.label}</div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: s.c, fontFamily: "'JetBrains Mono',monospace" }}>{s.val}</div>
                        </div>
                    ))}
                </div>

                {/* ─── MAIN CONTENT ─── */}
                <div style={{ padding: "28px", maxWidth: 1600, margin: "0 auto", width: "100%", flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>

                    {/* Row 1: Connected Clients + System Status + Threats */}
                    <div className="anim-panel anim-slide-up d0" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 20 }}>
                        <ConnectedClientsPanel tabs={tabs} />
                        <SystemStatusPanel stats={stats} wsConnected={wsConnected} />
                        <ThreatSummaryPanel threats={threats} />
                    </div>

                    {/* Row 2: Full-width Activity Feed */}
                    <div className="anim-panel anim-slide-up d1">
                        <ServerActivityFeed activities={clientActivities} />
                    </div>

                    {/* Row 3: Audit Log */}
                    <div className="anim-panel anim-slide-up d2" style={{
                        background: "rgba(10,21,32,0.6)", backdropFilter: "blur(12px)",
                        border: "1px solid #1e2d45", borderRadius: 14, padding: "20px",
                    }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <span style={{ fontSize: 18 }}>📋</span>
                                <span style={{ fontSize: 9, letterSpacing: 3, color: "#555" }}>AUDIT LOG</span>
                                {sessionLog.length > 0 && (
                                    <span style={{ background: "#0088ff", color: "#fff", fontSize: 10, fontWeight: 800, borderRadius: 10, padding: "2px 8px", fontFamily: "monospace" }}>{sessionLog.length}</span>
                                )}
                            </div>
                        </div>
                        <div style={{ maxHeight: 250, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                            {sessionLog.length === 0 ? (
                                <div style={{ textAlign: "center", padding: 24, color: "#3a5070", fontSize: 11 }}>No audit events yet</div>
                            ) : sessionLog.map((log, i) => (
                                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 12px", background: "rgba(0,0,0,0.2)", borderRadius: 8, border: "1px solid #1e2d4522" }}>
                                    <span style={{ fontSize: 9, color: "#3a5070", fontFamily: "monospace", flexShrink: 0, minWidth: 60 }}>{log.time || log.timestamp || ""}</span>
                                    <span style={{ fontSize: 10, color: "#8aa0b8" }}>{log.message || log.msg || JSON.stringify(log)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
