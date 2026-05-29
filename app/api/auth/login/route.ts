import { AUTH_COOKIE_NAME, SESSION_MAX_AGE_SECONDS, createSessionCookieValue, noStoreHeaders, safeRedirectPath, verifyDashboardPassword } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const password = String(formData.get("password") || "");
  const nextPath = safeRedirectPath(String(formData.get("next") || "/"));

  const valid = await verifyDashboardPassword(password);
  if (!valid) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "1");
    loginUrl.searchParams.set("next", nextPath);
    return NextResponse.redirect(loginUrl, { status: 303, headers: noStoreHeaders() });
  }

  const response = NextResponse.redirect(new URL(nextPath, request.url), { status: 303, headers: noStoreHeaders() });
  response.cookies.set(AUTH_COOKIE_NAME, await createSessionCookieValue(), {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:" || process.env.VERCEL === "1",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
