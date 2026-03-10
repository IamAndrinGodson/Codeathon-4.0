// lib/auth.ts — Authentication helper functions
// In production, these connect to the database. Placeholders for now.

import { createHmac, randomBytes } from "crypto";

/**
 * Verify a password against a bcrypt hash
 * In production: use bcrypt.compare()
 */
export async function verifyPassword(
    password: string,
    hash: string
): Promise<boolean> {
    // Production: import bcrypt and use bcrypt.compare(password, hash)
    // Placeholder for development
    return password.length > 0;
}

/**
 * Verify a TOTP code against a secret
 * In production: use otplib authenticator.verify()
 */
export function verifyTOTP(token: string, secret: string): boolean {
    // Production:
    // import { authenticator } from 'otplib';
    // return authenticator.verify({ token, secret });
    return token.length === 6;
}

/**
 * Get a user by email from the database
 */
export async function getUserByEmail(email: string) {
    // Production: query PostgreSQL
    // const user = await db.select().from(users).where(eq(users.email, email)).limit(1);
    // return user[0] || null;

    // Dev placeholder
    return {
        id: "dev-user-001",
        email,
        password_hash: "$2b$12$placeholder",
        totp_secret: null,
        role: "operator",
        org_id: "dev-org-001",
    };
}

/**
 * Generate a NEXTAUTH_SECRET-compatible random secret
 */
export function generateSecret(): string {
    return randomBytes(32).toString("base64");
}
