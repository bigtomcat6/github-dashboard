import { getDashboardData } from "@/lib/github";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
};

export async function GET() {
  try {
    return Response.json(await getDashboardData(), { headers: privateHeaders });
  } catch (error) {
    return Response.json({
      error: "Failed to generate GitHub dashboard summary.",
      message: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500, headers: privateHeaders });
  }
}
