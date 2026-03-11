"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { SessionProvider } from "../../components/session/SessionProvider";

const NexusDashboard = dynamic(
    () => import("../../components/session/NexusDashboard"),
    { ssr: false }
);

const ServerAdminDashboard = dynamic(
    () => import("../../components/session/ServerAdminDashboard"),
    { ssr: false }
);

export default function DashboardPage() {
    const [isAdmin, setIsAdmin] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        // Use environment variable, but fallback to port 3000 for local double-server dev
        const isLocalAdmin = window.location.port === "3000" || (window.location.port === "3002" && process.env.NEXT_PUBLIC_IS_SERVER === "true");
        const shouldBeAdmin = isLocalAdmin || process.env.NEXT_PUBLIC_IS_SERVER === "true";
        setIsAdmin(shouldBeAdmin);
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <div style={{ minHeight: "100vh", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", color: "#00e5a0", fontFamily: "'JetBrains Mono', monospace", fontSize: 14, letterSpacing: 2 }}>
                INITIALIZING NEXUS...
            </div>
        );
    }

    return (
        <SessionProvider>
            {isAdmin ? <ServerAdminDashboard /> : <NexusDashboard />}
        </SessionProvider>
    );
}
