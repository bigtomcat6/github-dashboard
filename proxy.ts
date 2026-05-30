import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, isDashboardProtectionEnabled, noStoreHeaders, verifySessionCookieValue } from "./lib/auth";

const PUBLIC_PATHS = new Set([
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/cards/languages.svg",
]);

export async function proxy(request: NextRequest) {
  if (!isDashboardProtectionEnabled()) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  if (!isProtectedPath(pathname) || PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const session = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  const validSession = await verifySessionCookieValue(session);
  if (validSession) {
    const response = NextResponse.next();
    setNoStore(response);
    return response;
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401, headers: noStoreHeaders() });
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", pathname);
  const response = NextResponse.redirect(loginUrl);
  setNoStore(response);
  return response;
}

export const config = {
  matcher: ["/", "/api/github/summary"],
};

function isProtectedPath(pathname: string) {
  return pathname === "/" || pathname === "/api/github/summary";
}

function setNoStore(response: NextResponse) {
  for (const [key, value] of Object.entries(noStoreHeaders() as Record<string, string>)) {
    response.headers.set(key, value);
  }
}
