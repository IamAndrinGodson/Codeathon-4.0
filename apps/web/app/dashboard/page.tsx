// app/dashboard/page.tsx — Main NEXUS TLS dashboard
"use client";

import { useSession } from "next-auth/react";
import { SessionProvider as NextAuthProvider } from "next-auth/react";
import { SessionProvider } from "../../components/session/SessionProvider";
import NexusDashboard from "../../components/session/NexusDashboard";

function DashboardContent() {
    const { data: session, status } = useSession();

    if (status === "loading") {
        return (
            <div
                style={{
                    minHeight: "100vh",
                    background: "#060d1a",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#00e5a0",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 14,
                    letterSpacing: 2,
                }}
            >
                LOADING SESSION...
            </div>
        );
    }

    return (
        <SessionProvider>
            <NexusDashboard />
        </SessionProvider>
    );
}

export default function DashboardPage() {
    return (
        <NextAuthProvider>
            <DashboardContent />
        </NextAuthProvider>
    );
}
