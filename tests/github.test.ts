import { describe, expect, it } from "vitest";
import { svgCard } from "../lib/github";

describe("public language card", () => {
  it("renders aggregate language percentages without repository-level metadata", () => {
    const svg = svgCard({
      username: "bigtomcat6",
      languages: [
        { name: "TypeScript", bytes: 900, percentage: 90, color: "#3178c6" },
        { name: "Swift", bytes: 100, percentage: 10, color: "#F05138" },
      ],
    });

    expect(svg).toContain("TypeScript");
    expect(svg).toContain("90.0%");
    expect(svg).not.toContain("repos");
    expect(svg).not.toContain("indexed");
    expect(svg).not.toContain("owner/private-repo");
    expect(svg).not.toContain("Stars");
    expect(svg).not.toContain("Forks");
  });
});
