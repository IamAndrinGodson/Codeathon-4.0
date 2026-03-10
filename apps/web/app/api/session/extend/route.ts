// app/api/session/extend/route.ts
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    // In production:
    // const session = await getServerSession(authOptions);
    // await redis.set(`last_activity:${session.sessionId}`, "now", { ex: 3600 });
    // await logSessionEvent(session.sessionId, "SESSION_EXTENDED", "info");

    return NextResponse.json({
        extended: true,
        message: "Session extended successfully",
    });
}
