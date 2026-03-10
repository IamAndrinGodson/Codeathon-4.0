// components/session/SessionProvider.tsx — Core session context with WS, timer, biometrics, broadcast
"use client";

import {
    createContext,
    useContext,
    useEffect,
    useRef,
    useState,
    useCallback,
    type ReactNode,
} from "react";

const BASE_TIMEOUT = 120;
const HEARTBEAT_INTERVAL = 10000;
const ACTIVITY_DEBOUNCE = 1500;
const WARN_AT = 30;
const IDLE_THRESHOLD_MS = 10_000; // Mark tab as idle after 10s no activity
// Dynamic WS URL — points to the FastAPI server set in RISK_API_URL env var.
// Falls back to localhost for local dev.
const _apiBase = (process.env.NEXT_PUBLIC_RISK_WS_URL ||
    (typeof window !== "undefined" ? window.location.origin.replace(/^http/, "ws") : "ws://localhost:8000"));
const WS_URL = `${_apiBase.replace(/\/+$/, "").replace(/^http/, "ws").replace("3000", "8000")}/ws/session/real/demo`;
const WS_RECONNECT_DELAY = 3_000;

const ACTIVITY_EVENTS = [
    "mousemove",
    "keydown",
    "mousedown",
    "touchstart",
    "scroll",
    "click",
] as const;

export interface TabInfo {
    id: string;
    title: string;
    route: string;
    active: boolean;
    idle: boolean;
    lastAct: string;
}

export interface SessionEvent {
    t: string;
    msg: string;
    type: string;
}

export interface RiskFactor {
    label: string;
    impact: string;
    delta: number;
}

export interface Transaction {
    id: string;
    type: string;
    amount: string;
    risk: string;
    status: string;
    route: string;
    time: string;
}

export interface TimelineEvent {
    pct: number;
    label: string;
    icon: string;
    type: string;
}

export interface ThreatEntry {
    time: string;
    action: string;
    severity: string;
    detail: string;
    source: string;
}

export interface ToastNotification {
    id: number;
    type: string;
    title: string;
    message: string;
    time: string;
}

export interface SystemStats {
    uptime: number;
    activeSessions: number;
    avgTrustScore: number;
    p95Latency: number;
    totalRequests: number;
    blockedThreats: number;
}

interface SessionState {
    remaining: number;
    adaptedTimeout: number;
    riskLevel: "LOW" | "MEDIUM" | "HIGH";
    biometricScore: number;
    keystrokeRhythm: number;
    mouseVelocity: number;
    scrollPattern: number;
    clickPattern: number;
    dwellTime: number;
    showWarning: boolean;
    isActive: boolean;
    tabs: TabInfo[];
    sessionLog: SessionEvent[];
    riskFactors: RiskFactor[];
    transactions: Transaction[];
    timeline: TimelineEvent[];
    wsConnected: boolean;
    // Business-class fields
    trustHistory: number[];
    threats: ThreatEntry[];
    systemStats: SystemStats;
    notifications: ToastNotification[];
    sessionElapsed: string;
    txnVolume: number;
    geoAnomaly: boolean;
    extend: () => void;
    killTab: (tabId: string) => void;
    logout: () => void;
    dismissNotification: (id: number) => void;
    updatePolicies: (baseTimeout: number, bioDrop: number, geoRadius: number, toggles: { strictGeo: boolean; killSync: boolean; threatBlock: boolean; jwtRot: boolean; txnRules: boolean }) => void;
}

const SessionContext = createContext<SessionState | null>(null);

// Stable per-tab UUID — persisted in sessionStorage so refreshes keep same ID.
function getOrCreateTabId(): string {
    if (typeof window === "undefined") return "ssr";
    const key = "nexus-tab-id";
    let id = sessionStorage.getItem(key);
    if (!id) { id = crypto.randomUUID(); sessionStorage.setItem(key, id); }
    return id;
}

export function SessionProvider({ children }: { children: ReactNode }) {
    const [remaining, setRemaining] = useState(BASE_TIMEOUT);
    const [adaptedTimeout, setAdaptedTimeout] = useState(BASE_TIMEOUT);
    const [riskLevel, setRiskLevel] = useState<"LOW" | "MEDIUM" | "HIGH">("LOW");
    const [biometricScore, setBiometricScore] = useState(91);
    const [keystrokeRhythm, setKeystrokeRhythm] = useState(88);
    const [mouseVelocity, setMouseVelocity] = useState(82);
    const [scrollPattern, setScrollPattern] = useState(79);
    const [clickPattern, setClickPattern] = useState(88);
    const [dwellTime, setDwellTime] = useState(92);
    const [showWarning, setShowWarning] = useState(false);
    const [isActive, setIsActive] = useState(true);
    const [riskFactors, setRiskFactors] = useState<RiskFactor[]>([]);
    const [tabs, setTabs] = useState<TabInfo[]>([
        { id: "tab-1", title: "Dashboard", route: "/dashboard", active: true, idle: false, lastAct: new Date().toTimeString().slice(0, 8) },
    ]);
    const [sessionLog, setSessionLog] = useState<SessionEvent[]>([
        { t: new Date().toTimeString().slice(0, 8), msg: "Session opened — NEXUS TLS v2", type: "success" },
    ]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
    const [wsConnected, setWsConnected] = useState(false);

    // Business-class state
    const [trustHistory, setTrustHistory] = useState<number[]>([91]);
    const [threats, setThreats] = useState<ThreatEntry[]>([]);
    const [systemStats, setSystemStats] = useState<SystemStats>({
        uptime: 99.97, activeSessions: 0, avgTrustScore: 91, p95Latency: 18, totalRequests: 0, blockedThreats: 0,
    });
    const [notifications, setNotifications] = useState<ToastNotification[]>([]);
    const [sessionElapsed, setSessionElapsed] = useState("00:00:00");
    const [txnVolume, setTxnVolume] = useState(0);
    const [geoAnomaly, setGeoAnomaly] = useState(false);

    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const workerRef = useRef<Worker | null>(null);
    const broadcastRef = useRef<BroadcastChannel | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const wsReconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Stable identity for this browser tab
    const tabIdRef = useRef<string>("tab-init");
    const tabIdleRef = useRef<boolean>(false);

    const addLog = useCallback((msg: string, type: string) => {
        const t = new Date().toTimeString().slice(0, 8);
        setSessionLog((prev) => [{ t, msg, type }, ...prev.slice(0, 19)]);
    }, []);

    const dismissNotification = useCallback((id: number) => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, []);

    // ── Helper: send to WS if open ──
    const wsSend = useCallback((obj: object) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(obj));
        }
    }, []);

    // ── WebSocket connection to backend ──
    const connectWs = useCallback(() => {
        try {
            const ws = new WebSocket(WS_URL);
            wsRef.current = ws;

            ws.onopen = () => {
                setWsConnected(true);
                const tabId = tabIdRef.current;
                console.log("[NEXUS WS] Connected — tabId:", tabId);
                // Announce this tab to the server with full context
                ws.send(JSON.stringify({
                    type: "TAB_OPEN",
                    tabId,
                    title: document.title || "Dashboard",
                    route: window.location.pathname,
                    visible: !document.hidden,
                    focused: document.hasFocus(),
                }));
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    if (data.forceLogout) {
                        window.location.href = "/auth/logout-summary";
                        return;
                    }

                    if (data.remaining !== undefined) setRemaining(data.remaining);
                    if (data.adaptedTimeout !== undefined) setAdaptedTimeout(data.adaptedTimeout);
                    if (data.riskLevel) setRiskLevel(data.riskLevel);
                    if (data.biometricScore !== undefined) setBiometricScore(data.biometricScore);
                    if (data.keystrokeRhythm !== undefined) setKeystrokeRhythm(data.keystrokeRhythm);
                    if (data.mouseVelocity !== undefined) setMouseVelocity(data.mouseVelocity);
                    if (data.scrollPattern !== undefined) setScrollPattern(data.scrollPattern);
                    if (data.clickPattern !== undefined) setClickPattern(data.clickPattern);
                    if (data.dwellTime !== undefined) setDwellTime(data.dwellTime);
                    if (data.showWarning !== undefined) setShowWarning(data.showWarning);
                    if (data.isActive !== undefined) setIsActive(data.isActive);
                    if (data.tabs) setTabs(data.tabs);
                    if (data.sessionLog) setSessionLog(data.sessionLog);
                    if (data.riskFactors) setRiskFactors(data.riskFactors);
                    if (data.transactions) setTransactions(data.transactions);
                    if (data.timeline) setTimeline(data.timeline);

                    // Business-class fields
                    if (data.trustHistory) setTrustHistory(data.trustHistory);
                    if (data.threats) setThreats(data.threats);
                    if (data.systemStats) setSystemStats(data.systemStats);
                    if (data.notifications?.length > 0) {
                        setNotifications((prev) => [...data.notifications, ...prev].slice(0, 8));
                    }
                    if (data.sessionElapsed) setSessionElapsed(data.sessionElapsed);
                    if (data.txnVolume !== undefined) setTxnVolume(data.txnVolume);
                    if (data.geoAnomaly !== undefined) setGeoAnomaly(data.geoAnomaly);
                } catch (e) {
                    console.error("[NEXUS WS] Failed to parse message", e);
                }
            };

            ws.onclose = () => {
                setWsConnected(false);
                wsReconnectRef.current = setTimeout(connectWs, WS_RECONNECT_DELAY);
            };

            ws.onerror = () => { setWsConnected(false); };
        } catch {
            setWsConnected(false);
        }
    }, []);

    // ── Tab ID initialisation ──
    useEffect(() => {
        tabIdRef.current = getOrCreateTabId();
    }, []);

    useEffect(() => {
        connectWs();
        return () => {
            if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
            if (wsReconnectRef.current) clearTimeout(wsReconnectRef.current);
        };
    }, [connectWs]);

    // ── Activity detection + telemetry to WS ──
    const resetTimer = useCallback(() => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            setRemaining(adaptedTimeout > 0 ? adaptedTimeout : BASE_TIMEOUT);
            setShowWarning(false);
        }
        setIsActive(true);

        // If this tab was idle, mark it active again
        if (tabIdleRef.current) {
            tabIdleRef.current = false;
            wsSend({ type: "TAB_ACTIVE", tabId: tabIdRef.current, timestamp: Date.now() });
        }
        // Reset idle timer on every activity
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        idleTimerRef.current = setTimeout(() => {
            tabIdleRef.current = true;
            wsSend({ type: "TAB_IDLE", tabId: tabIdRef.current, timestamp: Date.now() });
        }, IDLE_THRESHOLD_MS);
    }, [adaptedTimeout, wsSend]);

    const lastWsPing = useRef<number>(0);

    useEffect(() => {
        const handler = (ev: Event) => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(resetTimer, ACTIVITY_DEBOUNCE);

            const now = Date.now();
            if (now - lastWsPing.current > 1000) {
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                    if (ev.type === "mousemove") {
                        const me = ev as MouseEvent;
                        wsSend({ type: "mousemove", x: me.clientX, y: me.clientY, tabId: tabIdRef.current, timestamp: now });
                        lastWsPing.current = now;
                    } else if (ev.type === "keydown") {
                        wsSend({ type: "keydown", tabId: tabIdRef.current, timestamp: now });
                        lastWsPing.current = now;
                    } else if (ev.type === "click") {
                        const ce = ev as MouseEvent;
                        wsSend({ type: "click", tabId: tabIdRef.current, x: ce.clientX, y: ce.clientY, timestamp: now });
                        lastWsPing.current = now;
                    }
                }
            }

            if (workerRef.current) {
                if (ev.type === "keydown") {
                    workerRef.current.postMessage({ type: "KEYDOWN", data: { timestamp: Date.now() } });
                } else if (ev.type === "mousemove") {
                    const me = ev as MouseEvent;
                    workerRef.current.postMessage({ type: "MOUSEMOVE", data: { x: me.clientX, y: me.clientY, timestamp: Date.now() } });
                } else if (ev.type === "click") {
                    workerRef.current.postMessage({ type: "CLICK", data: { timestamp: Date.now() } });
                }
            }
        };
        ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, handler, { passive: true }));
        return () => {
            ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, handler));
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        };
    }, [resetTimer, wsSend]);

    // ── Tab Visibility & Focus tracking ──────────────────────────────────────────
    useEffect(() => {
        const tabId = tabIdRef.current;

        // Page Visibility API — fires when user switches browser tabs
        const onVisibilityChange = () => {
            const visible = !document.hidden;
            wsSend({
                type: "TAB_VISIBILITY",
                tabId,
                visible,
                title: document.title,
                route: window.location.pathname,
                timestamp: Date.now(),
            });
            broadcastRef.current?.postMessage({
                type: "TAB_VISIBILITY", tabId, visible,
                title: document.title, route: window.location.pathname,
            });
        };

        // Focus/Blur — fires when user alt-tabs to another app
        const onFocus = () => {
            wsSend({ type: "TAB_FOCUS", tabId, title: document.title, route: window.location.pathname, timestamp: Date.now() });
            broadcastRef.current?.postMessage({ type: "TAB_FOCUS", tabId });
        };
        const onBlur = () => {
            wsSend({ type: "TAB_BLUR", tabId, title: document.title, route: window.location.pathname, timestamp: Date.now() });
            broadcastRef.current?.postMessage({ type: "TAB_BLUR", tabId });
        };

        // Page navigation within SPA (popstate covers browser back/forward)
        const onPopState = () => {
            wsSend({
                type: "PAGE_CHANGE",
                tabId,
                route: window.location.pathname,
                title: document.title,
                timestamp: Date.now(),
            });
        };

        // Tab close — fire TAB_CLOSE before page unloads
        const onBeforeUnload = () => {
            // sendBeacon is reliable during unload; WS may already be closed
            const payload = JSON.stringify({ type: "TAB_CLOSE", tabId, title: document.title, route: window.location.pathname });
            const apiBase = process.env.NEXT_PUBLIC_RISK_API_URL || "http://localhost:8000";
            try { navigator.sendBeacon(`${apiBase}/api/session/tab-event`, payload); } catch { }
            wsSend({ type: "TAB_CLOSE", tabId });
            broadcastRef.current?.postMessage({ type: "TAB_CLOSE", tabId });
        };

        // Title change observer (catches Next.js soft-nav title updates)
        let titleObserver: MutationObserver | null = null;
        const titleEl = document.querySelector("title");
        if (titleEl) {
            titleObserver = new MutationObserver(() => {
                wsSend({
                    type: "PAGE_CHANGE",
                    tabId,
                    route: window.location.pathname,
                    title: document.title,
                    timestamp: Date.now(),
                });
            });
            titleObserver.observe(titleEl, { childList: true });
        }

        document.addEventListener("visibilitychange", onVisibilityChange);
        window.addEventListener("focus", onFocus);
        window.addEventListener("blur", onBlur);
        window.addEventListener("popstate", onPopState);
        window.addEventListener("beforeunload", onBeforeUnload);

        return () => {
            document.removeEventListener("visibilitychange", onVisibilityChange);
            window.removeEventListener("focus", onFocus);
            window.removeEventListener("blur", onBlur);
            window.removeEventListener("popstate", onPopState);
            window.removeEventListener("beforeunload", onBeforeUnload);
            titleObserver?.disconnect();
        };
    }, [wsSend]);

    // ── Countdown tick (only when WS is NOT connected) ──
    useEffect(() => {
        if (wsConnected) return;
        timerRef.current = setInterval(() => {
            setRemaining((prev) => {
                if (prev <= 1) { handleLogout(); return 0; }
                if (prev <= WARN_AT) setShowWarning(true);
                return prev - 1;
            });
        }, 1000);
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [wsConnected]);

    // ── Heartbeat (only when WS is NOT connected) ──
    useEffect(() => {
        if (wsConnected) return;
        const ping = async () => {
            try {
                const res = await fetch("/api/session/heartbeat", { method: "POST" });
                const data = await res.json();
                if (!data.valid) { handleLogout(); return; }
                setAdaptedTimeout(data.adapted_timeout);
                setRiskLevel(data.risk_level);
                if (data.active_factors) setRiskFactors(data.active_factors);
                addLog("Heartbeat OK — risk: " + data.risk_level, "info");
            } catch (e) { console.error("Heartbeat failed", e); }
        };
        ping();
        const interval = setInterval(ping, HEARTBEAT_INTERVAL);
        return () => clearInterval(interval);
    }, [wsConnected]);

    // ── Biometrics Web Worker (only when WS is NOT connected) ──
    useEffect(() => {
        if (wsConnected) return;
        try {
            workerRef.current = new Worker(new URL("../../lib/biometrics.worker.ts", import.meta.url));
            workerRef.current.onmessage = async (e) => {
                if (e.data.type === "REQUEST_SCORE") { workerRef.current?.postMessage({ type: "COMPUTE_SCORE" }); return; }
                const { score } = e.data;
                if (score !== undefined) {
                    setBiometricScore(score);
                    setKeystrokeRhythm(Math.max(50, Math.min(99, score + Math.round((Math.random() - 0.5) * 12))));
                    setMouseVelocity(Math.max(50, Math.min(99, score + Math.round((Math.random() - 0.5) * 16))));
                    setScrollPattern(Math.max(50, Math.min(99, score + Math.round((Math.random() - 0.5) * 10))));
                }
            };
        } catch {
            const interval = setInterval(() => {
                const d = () => Math.round((Math.random() - 0.5) * 6);
                setBiometricScore((p) => Math.max(55, Math.min(99, p + d())));
                setKeystrokeRhythm((p) => Math.max(60, Math.min(99, p + d())));
                setMouseVelocity((p) => Math.max(50, Math.min(99, p + d())));
                setScrollPattern((p) => Math.max(50, Math.min(99, p + d())));
            }, 3500);
            return () => clearInterval(interval);
        }
        return () => workerRef.current?.terminate();
    }, [wsConnected]);

    // ── BroadcastChannel — relay other-tab events to the WS server ──
    useEffect(() => {
        const myTabId = tabIdRef.current;
        try {
            broadcastRef.current = new BroadcastChannel("nexus-session");
            broadcastRef.current.onmessage = (e) => {
                const { type, tabId } = e.data;
                if (type === "LOGOUT") { handleLogout(); return; }
                if (type === "EXTEND") { resetTimer(); return; }

                // Relay foreign-tab events to the server via this tab's WS
                if (tabId && tabId !== myTabId) {
                    if (type === "TAB_ALIVE") {
                        setTabs((prev) => {
                            if (prev.find((t) => t.id === tabId)) return prev;
                            return [...prev, { id: tabId, title: e.data.title, route: e.data.route, active: false, idle: false, lastAct: new Date().toTimeString().slice(0, 8) }];
                        });
                        wsSend({ type: "TAB_OPEN", tabId, title: e.data.title, route: e.data.route, visible: true, focused: false });
                    } else if (type === "TAB_CLOSE") {
                        wsSend({ type: "TAB_CLOSE", tabId });
                    } else if (type === "TAB_VISIBILITY") {
                        wsSend({ type: "TAB_VISIBILITY", tabId, visible: e.data.visible, route: e.data.route, title: e.data.title, timestamp: Date.now() });
                    } else if (type === "TAB_FOCUS") {
                        wsSend({ type: "TAB_FOCUS", tabId, timestamp: Date.now() });
                    } else if (type === "TAB_BLUR") {
                        wsSend({ type: "TAB_BLUR", tabId, timestamp: Date.now() });
                    }
                }
            };
            // Announce this tab
            broadcastRef.current.postMessage({ type: "TAB_ALIVE", tabId: myTabId, title: document.title, route: window.location.pathname });
        } catch { }
        return () => broadcastRef.current?.close();
    }, [resetTimer, wsSend]);

    const extend = useCallback(async () => {
        resetTimer();
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "EXTEND" }));
        }
        await fetch("/api/session/extend", { method: "POST" }).catch(() => { });
        broadcastRef.current?.postMessage({ type: "EXTEND" });
        addLog("Session extended by user", "success");
    }, [resetTimer, addLog]);

    const logout = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "LOGOUT" }));
        }
    }, []);

    const updatePolicies = useCallback((baseTimeout: number, bioDrop: number, geoRadius: number, toggles: any) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: "POLICY_UPDATE",
                baseTimeout,
                bioDrop,
                geoRadius,
                toggles
            }));
        }
    }, []);

    const killTab = useCallback(async (tabId: string) => {
        await fetch(`/api/session/tab/${tabId}`, { method: "DELETE" }).catch(() => { });
        setTabs((prev) => prev.filter((t) => t.id !== tabId));
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "TAB_CLOSE", tabId }));
        }
        addLog(`Tab killed: ${tabId}`, "warn");
    }, [addLog]);

    const handleLogout = useCallback(() => {
        broadcastRef.current?.postMessage({ type: "LOGOUT" });
        if (timerRef.current) clearInterval(timerRef.current);
        if (wsRef.current) wsRef.current.close();
        window.location.href = "/auth/logout-summary";
    }, []);

    // ── Auto-dismiss notifications after 6s ──
    useEffect(() => {
        if (notifications.length === 0) return;
        const timer = setTimeout(() => {
            setNotifications((prev) => prev.slice(0, -1));
        }, 6000);
        return () => clearTimeout(timer);
    }, [notifications]);

    return (
        <SessionContext.Provider
            value={{
                remaining, adaptedTimeout, riskLevel, biometricScore, keystrokeRhythm,
                mouseVelocity, scrollPattern, clickPattern, dwellTime, showWarning, isActive,
                tabs, sessionLog, riskFactors, transactions, timeline, wsConnected,
                trustHistory, threats, systemStats, notifications, sessionElapsed, txnVolume,
                geoAnomaly,
                extend,
                killTab,
                logout: handleLogout,
                dismissNotification,
                updatePolicies,
            }}
        >
            {children}
        </SessionContext.Provider>
    );
}

export const useSessionEngine = () => {
    const ctx = useContext(SessionContext);
    if (!ctx) throw new Error("useSessionEngine must be used inside SessionProvider");
    return ctx;
};
