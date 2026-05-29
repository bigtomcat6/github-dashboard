import { AUTH_COOKIE_NAME, noStoreHeaders } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url), { status: 303, headers: noStoreHeaders() });
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:" || process.env.VERCEL === "1",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
