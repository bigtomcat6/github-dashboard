import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("protected route rendering configuration", () => {
  it("forces protected dashboard routes to render dynamically", () => {
    expect(source("app/page.tsx")).toContain('export const dynamic = "force-dynamic";');
    expect(source("app/api/github/summary/route.ts")).toContain('export const dynamic = "force-dynamic";');
  });
});
