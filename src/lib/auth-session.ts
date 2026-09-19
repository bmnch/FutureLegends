import { cookies } from "next/headers";
import { COOKIE_NAME, verifyToken } from "./auth-crypto";

export type SessionUser = {
  id: string;
  email: string;
};

/**
 * Resolve the signed-in user from the `civior_session` cookie.
 * Returns null (never throws) when the cookie is missing or invalid so callers
 * can respond with 401 / redirect as appropriate.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE_NAME)?.value;
    if (!token) return null;
    const payload = await verifyToken(token);
    return { id: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}
