// app/api/session/events/route.ts
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    const body = await request.json();

    // In production:
    // Insert into session_events table (TimescaleDB hypertable)
    // const { session_id, event_type, severity, metadata } = body;
    // await db.insert(sessionEvents).values({ ... });

    // If HIGH severity, push webhook to SIEM
    // if (severity === "high") await pushToSIEM(body);

    return NextResponse.json({ recorded: true });
}

export async function GET(request: Request) {
    // In production: fetch session events from TimescaleDB
    // const { searchParams } = new URL(request.url);
    // const sessionId = searchParams.get("session_id");
    // const events = await db.select().from(sessionEvents).where(...);

    // Dev placeholder
    return NextResponse.json({
        events: [
            { time: "09:42:11", event_type: "TXN_AUTHORIZED", severity: "info" },
            { time: "09:39:05", event_type: "2FA_VERIFIED", severity: "info" },
            { time: "09:38:47", event_type: "TXN_FLAGGED", severity: "warn" },
            { time: "09:35:22", event_type: "JWT_ROTATED", severity: "info" },
            { time: "09:30:00", event_type: "SESSION_OPENED", severity: "info" },
        ],
    });
}
