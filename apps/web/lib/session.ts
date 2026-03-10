// lib/session.ts — Redis session helpers
// In production, these interact with Upstash Redis

/**
 * Create a new session entry in Redis
 */
export async function createSession(
    sessionId: string,
    data: { userId: string; role: string }
): Promise<void> {
    // Production:
    // const redis = await getRedis();
    // const sessionData = {
    //   ...data,
    //   created_at: new Date().toISOString(),
    //   biometric_score: 100,
    //   adapted_timeout: 120,
    // };
    // await redis.setex(`session:${sessionId}`, 120, JSON.stringify(sessionData));
    // await redis.sadd(`user_sessions:${data.userId}`, sessionId);

    console.log(`[DEV] Session created: ${sessionId}`);
}

/**
 * Rotate JWT — issue new token with fresh iat
 */
export async function rotateJWT(token: Record<string, unknown>): Promise<Record<string, unknown>> {
    // Production:
    // 1. Add old JWT jti to denylist in Redis
    // 2. Generate new jti
    // 3. Update iat
    // await redis.setex(`denylist:${token.jti}`, originalTTL, "1");

    return {
        ...token,
        iat: Math.floor(Date.now() / 1000),
        jti: crypto.randomUUID(),
    };
}

/**
 * Revoke a session (logout)
 */
export async function revokeSession(
    sessionId: string,
    jti: string,
    originalTTL: number
): Promise<void> {
    // Production:
    // const redis = await getRedis();
    // await redis.setex(`denylist:${jti}`, originalTTL, "1");
    // await redis.del(`session:${sessionId}`);
    // await redis.del(`tabs:${sessionId}`);

    console.log(`[DEV] Session revoked: ${sessionId}`);
}
