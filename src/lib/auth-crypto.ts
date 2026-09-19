import { SignJWT, jwtVerify, type JWTPayload } from "jose";

const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BITS = 256;
const COOKIE_NAME = "civior_session";

export { COOKIE_NAME };

function getJwtSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "JWT_SECRET must be set to a strong secret (at least 32 characters).",
    );
  }
  return new TextEncoder().encode(secret);
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function base64ToBuffer(value: string): ArrayBuffer {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export function generateSalt(): string {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  return bufferToBase64(salt.buffer);
}

export async function hashPassword(
  password: string,
  salt: string,
): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const derived = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: base64ToBuffer(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    HASH_BITS,
  );

  return bufferToBase64(derived);
}

export async function verifyPassword(
  password: string,
  storedHash: string,
  storedSalt: string,
): Promise<boolean> {
  const candidate = await hashPassword(password, storedSalt);
  return timingSafeEqual(candidate, storedHash);
}

export type AuthTokenPayload = JWTPayload & {
  sub: string;
  email: string;
};

export async function signToken(payload: {
  sub: string;
  email: string;
}): Promise<string> {
  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtSecretKey());
}

export async function verifyToken(token: string): Promise<AuthTokenPayload> {
  const { payload } = await jwtVerify(token, getJwtSecretKey(), {
    algorithms: ["HS256"],
  });

  if (!payload.sub || typeof payload.email !== "string") {
    throw new Error("Invalid token payload.");
  }

  return payload as AuthTokenPayload;
}

export function buildSessionCookie(token: string): string {
  const maxAge = 60 * 60 * 24 * 7;
  const secure =
    process.env.NODE_ENV === "production" ||
    process.env.NEXT_PUBLIC_APP_URL?.startsWith("https://")
      ? "; Secure"
      : "";

  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function buildClearSessionCookie(): string {
  const secure =
    process.env.NODE_ENV === "production" ||
    process.env.NEXT_PUBLIC_APP_URL?.startsWith("https://")
      ? "; Secure"
      : "";

  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}
