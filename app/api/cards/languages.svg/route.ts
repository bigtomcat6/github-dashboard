import { cacheHeaders, getDashboardData, svgCard } from "@/lib/github";

export const runtime = "nodejs";
export const revalidate = 86400;

export async function GET() {
  try {
    const svg = svgCard(await getDashboardData());
    return new Response(svg, {
      headers: { ...cacheHeaders(), "Content-Type": "image/svg+xml; charset=utf-8" },
    });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Unknown error", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
