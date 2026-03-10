// components/session/SessionProvider.tsx — Core session context with timer, biometrics, broadcast
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

    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const workerRef = useRef<Worker | null>(null);
    const broadcastRef = useRef<BroadcastChannel | null>(null);

    const addLog = useCallback((msg: string, type: string) => {
        const t = new Date().toTimeString().slice(0, 8);
        setSessionLog((prev) => [{ time: t, msg, type }, ...prev.slice(0, 19)]);
    }, []);

    // ── Activity detection ──
    const resetTimer = useCallback(() => {
        setRemaining(adaptedTimeout > 0 ? adaptedTimeout : BASE_TIMEOUT);
        setShowWarning(false);
        setIsActive(true);
    }, [adaptedTimeout]);

    useEffect(() => {
        const handler = (ev: Event) => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(resetTimer, ACTIVITY_DEBOUNCE);

            // Forward raw events to the biometrics Web Worker
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

    // ── Countdown tick ──
    useEffect(() => {
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
    }, []);

    // ── Heartbeat to backend (every 15s) ──
    useEffect(() => {
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
    }, []);

    // ── Biometrics Web Worker ──
    useEffect(() => {
        try {
            workerRef.current = new Worker(
                new URL("../../lib/biometrics.worker.ts", import.meta.url)
            );
            workerRef.current.onmessage = async (e) => {
                if (e.data.type === "REQUEST_SCORE") {
                    // Worker is asking us to send COMPUTE_SCORE
                    workerRef.current?.postMessage({ type: "COMPUTE_SCORE" });
                    return;
                }
                const { score } = e.data;
                if (score !== undefined) {
                    setBiometricScore(score);
                    // Simulate sub-scores with realistic variance
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
    }, []);

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
        await fetch("/api/session/extend", { method: "POST" });
        broadcastRef.current?.postMessage({ type: "EXTEND" });
        addLog("Session extended by user", "success");
    }, [resetTimer, addLog]);

    const killTab = useCallback(
        async (tabId: string) => {
            await fetch(`/api/session/tab/${tabId}`, { method: "DELETE" }).catch(
                () => { }
            );
            setTabs((prev) => prev.filter((t) => t.id !== tabId));
            addLog(`Tab killed: ${tabId}`, "warn");
        },
        [addLog]
    );

    const handleLogout = useCallback(() => {
        broadcastRef.current?.postMessage({ type: "LOGOUT" });
        if (timerRef.current) clearInterval(timerRef.current);
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
