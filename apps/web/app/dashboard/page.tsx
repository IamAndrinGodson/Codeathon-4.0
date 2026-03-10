// app/dashboard/page.tsx — Main NEXUS TLS dashboard
"use client";

import dynamic from "next/dynamic";
import { SessionProvider } from "../../components/session/SessionProvider";

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

export default function DashboardPage() {
    return (
        <SessionProvider>
            <NexusDashboard />
        </SessionProvider>
    );
}
