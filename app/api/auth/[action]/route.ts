import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDb } from "@/src/db";
import { users } from "@/src/db/schema";
import {
  COOKIE_NAME,
  buildClearSessionCookie,
  buildSessionCookie,
  generateSalt,
  hashPassword,
  signToken,
  verifyPassword,
  verifyToken,
} from "@/src/lib/auth-crypto";

export const runtime = "edge";

type AuthBody = {
  email?: string;
  password?: string;
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function register(body: AuthBody) {
  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";

  if (!email || !isValidEmail(email)) {
    return NextResponse.json(
      { error: "A valid email is required." },
      { status: 400 },
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }

  const db = await getDb();
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing[0]) {
    return NextResponse.json(
      { error: "An account with this email already exists." },
      { status: 409 },
    );
  }

  const salt = generateSalt();
  const passwordHash = await hashPassword(password, salt);
  const id = crypto.randomUUID();

  await db.insert(users).values({
    id,
    email,
    passwordHash,
    salt,
    createdAt: new Date(),
  });

  const token = await signToken({ sub: id, email });

  return NextResponse.json(
    { ok: true, user: { id, email } },
    {
      status: 201,
      headers: { "Set-Cookie": buildSessionCookie(token) },
    },
  );
}

async function login(body: AuthBody) {
  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 },
    );
  }

  const db = await getDb();
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const user = rows[0];
  if (!user) {
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 },
    );
  }

  const valid = await verifyPassword(password, user.passwordHash, user.salt);
  if (!valid) {
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 },
    );
  }

  const token = await signToken({ sub: user.id, email: user.email });

  return NextResponse.json(
    { ok: true, user: { id: user.id, email: user.email } },
    {
      headers: { "Set-Cookie": buildSessionCookie(token) },
    },
  );
}

function logout() {
  return NextResponse.json(
    { ok: true },
    {
      headers: { "Set-Cookie": buildClearSessionCookie() },
    },
  );
}

async function session() {
  try {
    const jar = await cookies();
    const token = jar.get(COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json({ authenticated: false });
    }
    const payload = await verifyToken(token);
    return NextResponse.json({
      authenticated: true,
      user: { id: payload.sub, email: payload.email },
    });
  } catch {
    return NextResponse.json({ authenticated: false });
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ action: string }> },
) {
  try {
    const { action } = await context.params;
    if (action === "session") {
      return await session();
    }
    return NextResponse.json({ error: "Unknown auth action." }, { status: 404 });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    console.error("[api/auth GET]", error);
    return NextResponse.json(
      { error: message || "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ action: string }> },
) {
  try {
    const { action } = await context.params;

    if (action === "logout") {
      return logout();
    }

    let body: AuthBody;
    try {
      body = (await request.json()) as AuthBody;
    } catch {
      return NextResponse.json(
        { error: "Request body must be valid JSON." },
        { status: 400 },
      );
    }

    if (action === "register") {
      return await register(body);
    }
    if (action === "login") {
      return await login(body);
    }

    return NextResponse.json({ error: "Unknown auth action." }, { status: 404 });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    console.error("[api/auth POST]", error);
    return NextResponse.json(
      { error: message || "Internal Server Error" },
      { status: 500 },
    );
  }
}
