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
const WARN_AT = 30;
const HEARTBEAT_INTERVAL = 15_000;
const ACTIVITY_DEBOUNCE = 1_500;
const BIOMETRIC_INTERVAL = 10_000;
const WS_URL = "ws://localhost:8000/ws/session/demo";
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
    time: string;
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

interface SessionState {
    remaining: number;
    adaptedTimeout: number;
    riskLevel: "LOW" | "MEDIUM" | "HIGH";
    biometricScore: number;
    keystrokeRhythm: number;
    mouseVelocity: number;
    scrollPattern: number;
    showWarning: boolean;
    isActive: boolean;
    tabs: TabInfo[];
    sessionLog: SessionEvent[];
    riskFactors: RiskFactor[];
    transactions: Transaction[];
    timeline: TimelineEvent[];
    wsConnected: boolean;
    extend: () => void;
    killTab: (tabId: string) => void;
    logout: () => void;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
    const [remaining, setRemaining] = useState(BASE_TIMEOUT);
    const [adaptedTimeout, setAdaptedTimeout] = useState(BASE_TIMEOUT);
    const [riskLevel, setRiskLevel] = useState<"LOW" | "MEDIUM" | "HIGH">("LOW");
    const [biometricScore, setBiometricScore] = useState(91);
    const [keystrokeRhythm, setKeystrokeRhythm] = useState(88);
    const [mouseVelocity, setMouseVelocity] = useState(82);
    const [scrollPattern, setScrollPattern] = useState(79);
    const [showWarning, setShowWarning] = useState(false);
    const [isActive, setIsActive] = useState(true);
    const [riskFactors, setRiskFactors] = useState<RiskFactor[]>([]);
    const [tabs, setTabs] = useState<TabInfo[]>([
        { id: "tab-1", title: "Dashboard", route: "/dashboard", active: true, idle: false, lastAct: new Date().toTimeString().slice(0, 8) },
    ]);
    const [sessionLog, setSessionLog] = useState<SessionEvent[]>([
        { time: new Date().toTimeString().slice(0, 8), msg: "Session opened — NEXUS TLS v2", type: "success" },
    ]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
    const [wsConnected, setWsConnected] = useState(false);

    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const workerRef = useRef<Worker | null>(null);
    const broadcastRef = useRef<BroadcastChannel | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const wsReconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const addLog = useCallback((msg: string, type: string) => {
        const t = new Date().toTimeString().slice(0, 8);
        setSessionLog((prev) => [{ time: t, msg, type }, ...prev.slice(0, 19)]);
    }, []);

    // ── WebSocket connection to backend simulator ──
    const connectWs = useCallback(() => {
        try {
            const ws = new WebSocket(WS_URL);
            wsRef.current = ws;

            ws.onopen = () => {
                setWsConnected(true);
                console.log("[NEXUS WS] Connected to backend simulator");
                // Announce this tab
                ws.send(JSON.stringify({
                    type: "TAB_OPEN",
                    tabId: "tab-1",
                    title: document.title || "Dashboard",
                    route: window.location.pathname,
                }));
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    // Update all state from the backend payload
                    if (data.remaining !== undefined) setRemaining(data.remaining);
                    if (data.adaptedTimeout !== undefined) setAdaptedTimeout(data.adaptedTimeout);
                    if (data.riskLevel) setRiskLevel(data.riskLevel);
                    if (data.biometricScore !== undefined) setBiometricScore(data.biometricScore);
                    if (data.keystrokeRhythm !== undefined) setKeystrokeRhythm(data.keystrokeRhythm);
                    if (data.mouseVelocity !== undefined) setMouseVelocity(data.mouseVelocity);
                    if (data.scrollPattern !== undefined) setScrollPattern(data.scrollPattern);
                    if (data.showWarning !== undefined) setShowWarning(data.showWarning);
                    if (data.isActive !== undefined) setIsActive(data.isActive);
                    if (data.tabs) setTabs(data.tabs);
                    if (data.sessionLog) setSessionLog(data.sessionLog);
                    if (data.riskFactors) setRiskFactors(data.riskFactors);
                    if (data.transactions) setTransactions(data.transactions);
                    if (data.timeline) setTimeline(data.timeline);
                } catch (e) {
                    console.error("[NEXUS WS] Failed to parse message", e);
                }
            };

            ws.onclose = () => {
                setWsConnected(false);
                console.log("[NEXUS WS] Disconnected — will retry in", WS_RECONNECT_DELAY, "ms");
                // Reconnect after delay
                wsReconnectRef.current = setTimeout(connectWs, WS_RECONNECT_DELAY);
            };

            ws.onerror = () => {
                // onclose will fire after this, which handles reconnect
                setWsConnected(false);
            };
        } catch {
            console.warn("[NEXUS WS] WebSocket not available — falling back to simulation");
            setWsConnected(false);
        }
    }, []);

    useEffect(() => {
        connectWs();
        return () => {
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
            if (wsReconnectRef.current) {
                clearTimeout(wsReconnectRef.current);
            }
        };
    }, [connectWs]);

    // ── Activity detection (also forwards telemetry to WS) ──
    const resetTimer = useCallback(() => {
        // Only reset timer locally if NOT connected to WS (WS drives the timer)
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            setRemaining(adaptedTimeout > 0 ? adaptedTimeout : BASE_TIMEOUT);
            setShowWarning(false);
        }
        setIsActive(true);
    }, [adaptedTimeout]);

    useEffect(() => {
        const handler = (ev: Event) => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(resetTimer, ACTIVITY_DEBOUNCE);

            // Forward telemetry to WebSocket if connected
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                if (ev.type === "mousemove") {
                    const me = ev as MouseEvent;
                    wsRef.current.send(JSON.stringify({
                        type: "mousemove",
                        x: me.clientX,
                        y: me.clientY,
                        timestamp: Date.now(),
                    }));
                } else if (ev.type === "keydown") {
                    wsRef.current.send(JSON.stringify({
                        type: "keydown",
                        timestamp: Date.now(),
                    }));
                }
            }

            // Forward raw events to the biometrics Web Worker (fallback)
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
        ACTIVITY_EVENTS.forEach((e) =>
            window.addEventListener(e, handler, { passive: true })
        );
        return () =>
            ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, handler));
    }, [resetTimer]);

    // ── Countdown tick (only active when WS is NOT connected) ──
    useEffect(() => {
        if (wsConnected) return; // WS drives the countdown

        timerRef.current = setInterval(() => {
            setRemaining((prev) => {
                if (prev <= 1) {
                    handleLogout();
                    return 0;
                }
                if (prev <= WARN_AT) setShowWarning(true);
                return prev - 1;
            });
        }, 1000);
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [wsConnected]);

    // ── Heartbeat to backend (only when WS is NOT connected) ──
    useEffect(() => {
        if (wsConnected) return; // WS replaces heartbeat

        const ping = async () => {
            try {
                const res = await fetch("/api/session/heartbeat", { method: "POST" });
                const data = await res.json();
                if (!data.valid) {
                    handleLogout();
                    return;
                }
                setAdaptedTimeout(data.adapted_timeout);
                setRiskLevel(data.risk_level);
                if (data.active_factors) {
                    setRiskFactors(data.active_factors);
                }
                addLog("Heartbeat OK — risk: " + data.risk_level, "info");
            } catch (e) {
                console.error("Heartbeat failed", e);
            }
        };
        ping();
        const interval = setInterval(ping, HEARTBEAT_INTERVAL);
        return () => clearInterval(interval);
    }, [wsConnected]);

    // ── Biometrics Web Worker (only when WS is NOT connected) ──
    useEffect(() => {
        if (wsConnected) return; // WS drives biometric scores

        try {
            workerRef.current = new Worker(
                new URL("../../lib/biometrics.worker.ts", import.meta.url)
            );
            workerRef.current.onmessage = async (e) => {
                if (e.data.type === "REQUEST_SCORE") {
                    workerRef.current?.postMessage({ type: "COMPUTE_SCORE" });
                    return;
                }
                const { score } = e.data;
                if (score !== undefined) {
                    setBiometricScore(score);
                    setKeystrokeRhythm(Math.max(50, Math.min(99, score + Math.round((Math.random() - 0.5) * 12))));
                    setMouseVelocity(Math.max(50, Math.min(99, score + Math.round((Math.random() - 0.5) * 16))));
                    setScrollPattern(Math.max(50, Math.min(99, score + Math.round((Math.random() - 0.5) * 10))));
                }
            };
        } catch {
            // Web Worker may not be available — simulate biometric drift instead
            console.warn("Biometrics worker not available — using simulation");
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

    // ── BroadcastChannel (cross-tab) ──
    useEffect(() => {
        try {
            broadcastRef.current = new BroadcastChannel("nexus-session");
            broadcastRef.current.onmessage = (e) => {
                if (e.data.type === "LOGOUT") handleLogout();
                if (e.data.type === "EXTEND") resetTimer();
                if (e.data.type === "TABS_UPDATE") setTabs(e.data.tabs);
                if (e.data.type === "TAB_ALIVE") {
                    setTabs((prev) => {
                        const exists = prev.find((t) => t.id === e.data.tabId);
                        if (exists) return prev;
                        return [...prev, {
                            id: e.data.tabId,
                            title: e.data.title,
                            route: e.data.route,
                            active: false,
                            idle: false,
                            lastAct: new Date().toTimeString().slice(0, 8),
                        }];
                    });
                    // Also notify WS backend of the new tab
                    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                        wsRef.current.send(JSON.stringify({
                            type: "TAB_OPEN",
                            tabId: e.data.tabId,
                            title: e.data.title,
                            route: e.data.route,
                        }));
                    }
                }
            };

            // Announce this tab
            const tabId = crypto.randomUUID();
            broadcastRef.current.postMessage({
                type: "TAB_ALIVE",
                tabId,
                title: document.title,
                route: window.location.pathname,
            });
        } catch {
            console.warn("BroadcastChannel not available");
        }
        return () => broadcastRef.current?.close();
    }, [resetTimer]);

    const extend = useCallback(async () => {
        resetTimer();
        // Notify WS backend to reset timer
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "EXTEND" }));
        }
        await fetch("/api/session/extend", { method: "POST" }).catch(() => { });
        broadcastRef.current?.postMessage({ type: "EXTEND" });
        addLog("Session extended by user", "success");
    }, [resetTimer, addLog]);

    const killTab = useCallback(
        async (tabId: string) => {
            await fetch(`/api/session/tab/${tabId}`, { method: "DELETE" }).catch(
                () => { }
            );
            setTabs((prev) => prev.filter((t) => t.id !== tabId));
            // Notify WS backend
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: "TAB_CLOSE", tabId }));
            }
            addLog(`Tab killed: ${tabId}`, "warn");
        },
        [addLog]
    );

    const handleLogout = useCallback(() => {
        broadcastRef.current?.postMessage({ type: "LOGOUT" });
        if (timerRef.current) clearInterval(timerRef.current);
        if (wsRef.current) wsRef.current.close();
        window.location.href = "/auth/logout-summary";
    }, []);

    return (
        <SessionContext.Provider
            value={{
                remaining,
                adaptedTimeout,
                riskLevel,
                biometricScore,
                keystrokeRhythm,
                mouseVelocity,
                scrollPattern,
                showWarning,
                isActive,
                tabs,
                sessionLog,
                riskFactors,
                transactions,
                timeline,
                wsConnected,
                extend,
                killTab,
                logout: handleLogout,
            }}
        >
            {children}
        </SessionContext.Provider>
    );
}

export const useSessionEngine = () => {
    const ctx = useContext(SessionContext);
    if (!ctx)
        throw new Error("useSessionEngine must be used inside SessionProvider");
    return ctx;
};
