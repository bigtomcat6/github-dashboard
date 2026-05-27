import { cacheHeaders, getDashboardData } from "@/lib/github";

export const runtime = "nodejs";
export const revalidate = 86400;

export async function GET() {
  try {
    return Response.json(await getDashboardData(), { headers: cacheHeaders() });
  } catch (error) {
    return Response.json({
      error: "Failed to generate GitHub dashboard summary.",
      message: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}
