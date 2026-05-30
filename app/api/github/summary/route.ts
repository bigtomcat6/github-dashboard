import { assertProtectedDashboardConfigured, noStoreHeaders } from "@/lib/auth";
import { getDashboardData } from "@/lib/github";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    assertProtectedDashboardConfigured();
    return Response.json(await getDashboardData(), { headers: noStoreHeaders() });
  } catch (error) {
    return Response.json({
      error: "Failed to generate GitHub dashboard summary.",
      message: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500, headers: noStoreHeaders() });
  }
}
