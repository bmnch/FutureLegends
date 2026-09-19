import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
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

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init);
}

async function register(body: AuthBody) {
  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";

  if (!email || !isValidEmail(email)) {
    return json({ error: "A valid email is required." }, { status: 400 });
  }
  if (password.length < 8) {
    return json(
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
    return json({ error: "An account with this email already exists." }, { status: 409 });
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

  return json(
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
    return json({ error: "Email and password are required." }, { status: 400 });
  }

  const db = await getDb();
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  const user = rows[0];
  if (!user) {
    return json({ error: "Invalid email or password." }, { status: 401 });
  }

  const valid = await verifyPassword(password, user.passwordHash, user.salt);
  if (!valid) {
    return json({ error: "Invalid email or password." }, { status: 401 });
  }

  const token = await signToken({ sub: user.id, email: user.email });

  return json(
    { ok: true, user: { id: user.id, email: user.email } },
    {
      headers: { "Set-Cookie": buildSessionCookie(token) },
    },
  );
}

function logout() {
  return json(
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
      return json({ authenticated: false });
    }
    const payload = await verifyToken(token);
    return json({
      authenticated: true,
      user: { id: payload.sub, email: payload.email },
    });
  } catch {
    return json({ authenticated: false });
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ action: string }> },
) {
  const { action } = await context.params;
  if (action === "session") {
    return session();
  }
  return json({ error: "Unknown auth action." }, { status: 404 });
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

    const body = (await request.json()) as AuthBody;

    if (action === "register") {
      return await register(body);
    }
    if (action === "login") {
      return await login(body);
    }

    return json({ error: "Unknown auth action." }, { status: 404 });
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error ? error.message : "Authentication failed.",
      },
      { status: 500 },
    );
  }
}
