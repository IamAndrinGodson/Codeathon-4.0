// app/dashboard/page.tsx — Main NEXUS TLS dashboard
// Renders ServerAdminDashboard when NEXT_PUBLIC_IS_SERVER=true,
// otherwise renders the standard client NexusDashboard.
"use client";

import dynamic from "next/dynamic";
import { SessionProvider } from "../../components/session/SessionProvider";

const isServer = process.env.NEXT_PUBLIC_IS_SERVER === "true";

const NexusDashboard = dynamic(
    () => import("../../components/session/NexusDashboard"),
    {
        ssr: false, loading: () => (
            <div style={{ minHeight: "100vh", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", color: "#00e5a0", fontFamily: "'JetBrains Mono', monospace", fontSize: 14, letterSpacing: 2 }}>
                INITIALIZING NEXUS...
            </div>
        )
    }
);

const ServerAdminDashboard = dynamic(
    () => import("../../components/session/ServerAdminDashboard"),
    {
        ssr: false, loading: () => (
            <div style={{ minHeight: "100vh", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", color: "#ff4d4d", fontFamily: "'JetBrains Mono', monospace", fontSize: 14, letterSpacing: 2 }}>
                INITIALIZING NEXUS ADMIN...
            </div>
        )
    }
);

export default function DashboardPage() {
    return (
        <SessionProvider>
            {isServer ? <ServerAdminDashboard /> : <NexusDashboard />}
        </SessionProvider>
    );
}
