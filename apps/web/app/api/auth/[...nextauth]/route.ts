// app/api/auth/[...nextauth]/route.ts — NextAuth config
import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

// In production, replace these with real imports:
// import { verifyPassword, verifyTOTP, getUserByEmail } from "@/lib/auth";
// import { createSession, rotateJWT } from "@/lib/session";

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: "credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
                totp: { label: "TOTP Code", type: "text" },
            },
            async authorize(credentials) {
                if (!credentials) return null;

                // --- Production: uncomment and use real auth logic ---
                // const user = await getUserByEmail(credentials.email);
                // if (!user) return null;
                // const passwordValid = await verifyPassword(credentials.password, user.password_hash);
                // if (!passwordValid) return null;
                // if (user.totp_secret) {
                //   const totpValid = verifyTOTP(credentials.totp, user.totp_secret);
                //   if (!totpValid) throw new Error("INVALID_TOTP");
                // }
                // return { id: user.id, email: user.email, role: user.role, orgId: user.org_id };

                // --- Dev placeholder: accept any login ---
                return {
                    id: "dev-user-001",
                    email: credentials.email,
                    role: "operator",
                    orgId: "dev-org-001",
                };
            },
        }),
    ],
    session: {
        strategy: "jwt",
        maxAge: 4 * 60 * 60, // 4 hours absolute maximum
    },
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.userId = user.id;
                token.role = (user as any).role;
                token.orgId = (user as any).orgId;
                token.sessionId = crypto.randomUUID();
                // Production: create Redis session entry
                // await createSession(token.sessionId as string, { userId: user.id, role: (user as any).role });
            }

            // Rotate JWT every 5 minutes (rolling token)
            const now = Math.floor(Date.now() / 1000);
            if (token.iat && now - (token.iat as number) > 300) {
                // Production: await rotateJWT(token);
                token.iat = now;
            }

            return token;
        },
        async session({ session, token }) {
            (session as any).user.id = token.userId as string;
            (session as any).user.role = token.role as string;
            (session as any).sessionId = token.sessionId as string;
            return session;
        },
    },
    pages: {
        signIn: "/auth/login",
        error: "/auth/error",
    },
    // Cookie config: let NextAuth auto-select the cookie name based on environment.
    // On HTTP (localhost), it uses "next-auth.session-token".
    // On HTTPS (production), it uses "__Secure-next-auth.session-token".
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
