# Vercel Auth Cache Hardening Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the Vercel deployment so only the public language SVG is cacheable/public, while repository-level dashboard data remains password protected and never becomes static/ISR output.

**Architecture:** Keep two explicit data contracts: a public language-card contract that exposes only aggregate language distribution, and a protected dashboard contract that can expose repository-level data only behind `DASHBOARD_PASSWORD`. Protected responses use no-store response headers, but internal GitHub fetches can continue using Next/Vercel Data Cache to reduce Vercel and GitHub API cost.

**Tech Stack:** Next.js App Router 16, TypeScript, Vitest, Vercel CDN/Data Cache, GitHub REST API.

---

## File Structure

- Modify `.github/workflows/ci.yml`: use the same package manager as the committed lockfile.
- Modify `package.json`: keep scripts package-manager neutral and add package-manager metadata if needed.
- Modify `pnpm-lock.yaml`: include `vitest` so CI/local installs are reproducible.
- Modify `lib/auth.ts`: centralize public/private cache headers and fail-closed production checks.
- Modify `lib/github.ts`: split public SVG data from protected dashboard data.
- Modify `proxy.ts`: reuse shared no-store headers for protected paths.
- Modify `app/page.tsx`: force protected dashboard rendering to be dynamic on Vercel.
- Modify `app/api/github/summary/route.ts`: enforce fail-closed config and no-store headers.
- Modify `app/api/cards/languages.svg/route.ts`: serve only public language-card data with Vercel CDN cache headers.
- Modify `README.md`: document Vercel deployment variables and cache/security model.
- Modify `tests/auth.test.ts`: add auth/cache/fail-closed helper tests.
- Create `tests/github.test.ts`: add SVG output contract tests.

---

## Chunk 1: Reproducible Test Baseline

### Task 1: Align Package Manager and CI

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Confirm current lockfile/tooling state**

Run: `git status --short && ls pnpm-lock.yaml package-lock.json 2>/dev/null || true`

Expected: clean worktree except this plan, `pnpm-lock.yaml` exists, no `package-lock.json`.

- [ ] **Step 2: Update lockfile for existing test dependency**

Run: `corepack pnpm install --lockfile-only`

Expected: `pnpm-lock.yaml` records `vitest` and related packages.

- [ ] **Step 3: Update CI to use pnpm**

Change `.github/workflows/ci.yml` install/check steps to:

```yaml
      - name: Enable Corepack
        run: corepack enable

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run tests
        run: pnpm test

      - name: Type check
        run: pnpm typecheck

      - name: Production build
        run: pnpm build
```

- [ ] **Step 4: Verify package baseline**

Run: `corepack pnpm test`

Expected: existing tests run. They may pass or expose pre-existing gaps; record exact output before changing production behavior.

---

## Chunk 2: Auth and Cache Helpers

### Task 2: Add Cache Header and Fail-Closed Tests

**Files:**
- Modify: `tests/auth.test.ts`
- Modify later: `lib/auth.ts`

- [ ] **Step 1: Write failing tests**

Add tests for:

```ts
it("sets no-store headers for protected responses on Vercel", () => {
  expect(noStoreHeaders()).toEqual({
    "Cache-Control": "private, no-store, max-age=0",
    "CDN-Cache-Control": "no-store",
    "Vercel-CDN-Cache-Control": "no-store",
  });
});

it("sets public Vercel CDN cache headers for the language card", () => {
  expect(publicCacheHeaders(86400)).toEqual({
    "Cache-Control": "public, max-age=0, s-maxage=86400",
    "CDN-Cache-Control": "public, max-age=86400",
    "Vercel-CDN-Cache-Control": "public, max-age=86400",
  });
});

it("fails closed in production when private dashboard data is enabled without a password", () => {
  process.env.NODE_ENV = "production";
  process.env.GITHUB_TOKEN = "token";
  process.env.INCLUDE_PRIVATE = "true";
  delete process.env.DASHBOARD_PASSWORD;

  expect(() => assertProtectedDashboardConfigured()).toThrow(/DASHBOARD_PASSWORD/);
});

it("allows the public language card to be generated without a dashboard password", () => {
  process.env.NODE_ENV = "production";
  process.env.GITHUB_TOKEN = "token";
  process.env.INCLUDE_PRIVATE = "true";
  delete process.env.DASHBOARD_PASSWORD;

  expect(isPublicLanguageCardAllowed()).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify RED**

Run: `corepack pnpm test tests/auth.test.ts`

Expected: FAIL because `publicCacheHeaders`, `assertProtectedDashboardConfigured`, and `isPublicLanguageCardAllowed` do not exist, and `noStoreHeaders` lacks CDN-specific headers.

- [ ] **Step 3: Implement auth/cache helpers**

In `lib/auth.ts`, add:

```ts
export function noStoreHeaders(): HeadersInit {
  return {
    "Cache-Control": "private, no-store, max-age=0",
    "CDN-Cache-Control": "no-store",
    "Vercel-CDN-Cache-Control": "no-store",
  };
}

export function publicCacheHeaders(seconds: number): HeadersInit {
  const maxAge = Math.max(0, Math.floor(seconds));
  return {
    "Cache-Control": `public, max-age=0, s-maxage=${maxAge}`,
    "CDN-Cache-Control": `public, max-age=${maxAge}`,
    "Vercel-CDN-Cache-Control": `public, max-age=${maxAge}`,
  };
}

export function assertProtectedDashboardConfigured() {
  if (!isProductionLikeRuntime()) return;
  if (!privateRepositoryDataEnabled()) return;
  if (isDashboardProtectionEnabled()) return;
  throw new Error("DASHBOARD_PASSWORD is required in production when private dashboard data is enabled.");
}

export function isPublicLanguageCardAllowed() {
  return true;
}
```

Use helpers:

```ts
function privateRepositoryDataEnabled() {
  return Boolean(process.env.GITHUB_TOKEN?.trim()) && parseBool(process.env.INCLUDE_PRIVATE, true);
}

function isProductionLikeRuntime() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
}
```

- [ ] **Step 4: Run tests to verify GREEN**

Run: `corepack pnpm test tests/auth.test.ts`

Expected: PASS.

---

## Chunk 3: Public SVG Contract

### Task 3: Test SVG Does Not Expose Repository-Level Data

**Files:**
- Create: `tests/github.test.ts`
- Modify later: `lib/github.ts`
- Modify later: `app/api/cards/languages.svg/route.ts`

- [ ] **Step 1: Write failing SVG contract tests**

Create `tests/github.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify RED**

Run: `corepack pnpm test tests/github.test.ts`

Expected: FAIL because `svgCard` currently expects full `DashboardData` and renders repository count and indexed bytes.

- [ ] **Step 3: Split public language-card data contract**

In `lib/github.ts`, add:

```ts
export type LanguageCardData = {
  username: string;
  languages: LanguageStat[];
};

export async function getLanguageCardData(): Promise<LanguageCardData> {
  const data = await getDashboardData();
  return {
    username: data.meta.username,
    languages: data.languages,
  };
}
```

Change `svgCard` signature:

```ts
export function svgCard(data: LanguageCardData) {
  // Keep language names/percentages only. Do not render repo count,
  // total bytes, repository names, URLs, stars, forks, or descriptions.
}
```

Remove the footer that currently renders repository count and total language bytes.

- [ ] **Step 4: Update SVG route cache headers**

In `app/api/cards/languages.svg/route.ts`:

```ts
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
      headers: { "Content-Type": "text/plain; charset=utf-8", ...publicCacheHeaders(300) },
    });
  }
}
```

- [ ] **Step 5: Run tests to verify GREEN**

Run: `corepack pnpm test tests/github.test.ts tests/auth.test.ts`

Expected: PASS.

---

## Chunk 4: Protected Dashboard Runtime Behavior

### Task 4: Force Protected Routes Dynamic and No-Store

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/api/github/summary/route.ts`
- Modify: `proxy.ts`
- Test: `tests/auth.test.ts`

- [ ] **Step 1: Write failing tests for protected route headers/config**

Add helper-level assertions in `tests/auth.test.ts`:

```ts
it("does not fail closed when private data is disabled", () => {
  process.env.NODE_ENV = "production";
  delete process.env.DASHBOARD_PASSWORD;
  process.env.GITHUB_TOKEN = "token";
  process.env.INCLUDE_PRIVATE = "false";

  expect(() => assertProtectedDashboardConfigured()).not.toThrow();
});

it("does not fail closed outside production-like runtimes", () => {
  process.env.NODE_ENV = "development";
  delete process.env.VERCEL;
  delete process.env.DASHBOARD_PASSWORD;
  process.env.GITHUB_TOKEN = "token";
  process.env.INCLUDE_PRIVATE = "true";

  expect(() => assertProtectedDashboardConfigured()).not.toThrow();
});
```

- [ ] **Step 2: Run tests to verify RED or current helper behavior**

Run: `corepack pnpm test tests/auth.test.ts`

Expected: PASS only after Task 2 helper implementation is complete. If it fails, fix helper behavior before touching routes.

- [ ] **Step 3: Update dashboard page runtime config**

In `app/page.tsx`:

```ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
```

Remove:

```ts
export const revalidate = 86400;
```

At the start of `Home()` before `getDashboardData()`:

```ts
assertProtectedDashboardConfigured();
```

- [ ] **Step 4: Update summary API**

In `app/api/github/summary/route.ts`:

```ts
import { assertProtectedDashboardConfigured, noStoreHeaders } from "@/lib/auth";

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
```

- [ ] **Step 5: Update proxy to reuse no-store headers**

Replace manual header setting in `proxy.ts` with:

```ts
function setNoStore(response: NextResponse) {
  for (const [key, value] of Object.entries(noStoreHeaders())) {
    response.headers.set(key, value);
  }
}
```

- [ ] **Step 6: Verify build output no longer pre-renders dashboard**

Run: `DASHBOARD_PASSWORD=review-test corepack pnpm build`

Expected: `/` is shown as dynamic (`ƒ /`) rather than static (`○ /`).

---

## Chunk 5: Vercel Documentation and Final Verification

### Task 5: Document Vercel Deployment Contract

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update environment variable table**

Add:

```md
| `DASHBOARD_PASSWORD` | Required when private dashboard data is enabled in production | empty | Password that protects the dashboard and JSON summary routes. |
| `DASHBOARD_SESSION_SECRET` | Recommended in production | falls back to `DASHBOARD_PASSWORD` | HMAC signing secret for dashboard session cookies. Use a long random value. |
| `SHOW_REPOSITORY_DETAILS` | No | `true` when password protection is enabled | Controls repository-level detail visibility inside the protected dashboard. |
```

- [ ] **Step 2: Add cache/security model section**

Document:

```md
- `/api/cards/languages.svg` is intentionally public and CDN-cacheable. It must only expose aggregate language names and percentages.
- `/` and `/api/github/summary` are protected when `DASHBOARD_PASSWORD` is set and return no-store headers.
- In Vercel production, private dashboard data requires `DASHBOARD_PASSWORD`; otherwise protected routes fail closed.
- GitHub fetches may use Next/Vercel Data Cache to reduce API and function cost, but protected HTTP responses are not shared-cacheable.
```

- [ ] **Step 3: Run full verification**

Run:

```bash
corepack pnpm test
corepack pnpm typecheck
DASHBOARD_PASSWORD=review-test corepack pnpm build
git status --short
```

Expected:
- Tests pass.
- Typecheck passes.
- Build passes.
- Build output shows `/` as dynamic (`ƒ /`).
- Worktree has only intended files changed.

---

## Execution Notes

- Do not protect `/api/cards/languages.svg`; it is intentionally public.
- Do not let repository names, descriptions, URLs, stars, forks, timestamps, or repo counts leak into the public SVG.
- Keep protected HTTP responses no-store even if internal GitHub fetches use Data Cache.
- If dependency installation needs network access, request sandbox escalation for the package-manager command rather than editing lockfiles by hand.
