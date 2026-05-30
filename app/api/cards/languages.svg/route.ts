import { publicCacheHeaders } from "@/lib/auth";
import { getLanguageCardData, svgCard } from "@/lib/github";

export const runtime = "nodejs";
export const revalidate = 86400;

export async function GET() {
  try {
    const svg = svgCard(await getLanguageCardData());
    return new Response(svg, {
      headers: { ...publicCacheHeaders(86400), "Content-Type": "image/svg+xml; charset=utf-8" },
    });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Unknown error", {
      status: 500,
      headers: { ...publicCacheHeaders(300), "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
