import { jwtVerify } from "jose";
import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME } from "@/src/lib/auth-crypto";

const PROTECTED = [/^\/dashboard(\/.*)?$/, /^\/api\/checkout(\/.*)?$/];

function getSecret(): Uint8Array | null {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) return null;
  return new TextEncoder().encode(secret);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const needsAuth = PROTECTED.some((pattern) => pattern.test(pathname));
  if (!needsAuth) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const secret = getSecret();

  if (!token || !secret) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("auth", "required");
    return NextResponse.redirect(url);
  }

  try {
    await jwtVerify(token, secret, { algorithms: ["HS256"] });
    return NextResponse.next();
  } catch {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("auth", "required");
    const response = NextResponse.redirect(url);
    response.cookies.set(COOKIE_NAME, "", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 0,
    });
    return response;
  }
}

export const config = {
  matcher: ["/dashboard", "/dashboard/:path*", "/api/checkout", "/api/checkout/:path*"],
};
