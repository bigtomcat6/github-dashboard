import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  SESSION_MAX_AGE_SECONDS,
  assertProtectedDashboardConfigured,
  createSessionCookieValue,
  isPublicLanguageCardAllowed,
  noStoreHeaders,
  publicCacheHeaders,
  safeRedirectPath,
  shouldShowRepositoryDetails,
  verifyDashboardPassword,
  verifySessionCookieValue,
} from "../lib/auth";

vi.useFakeTimers();

describe("dashboard auth helpers", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    vi.stubEnv("NODE_ENV", "test");
    process.env.DASHBOARD_PASSWORD = "test-password";
    delete process.env.DASHBOARD_SESSION_SECRET;
    delete process.env.GITHUB_TOKEN;
    delete process.env.INCLUDE_PRIVATE;
    delete process.env.SHOW_REPOSITORY_DETAILS;
    delete process.env.VERCEL;
  });

  it("accepts the configured dashboard password", async () => {
    await expect(verifyDashboardPassword("test-password")).resolves.toBe(true);
  });

  it("rejects an incorrect dashboard password", async () => {
    await expect(verifyDashboardPassword("wrong-password")).resolves.toBe(false);
  });

  it("creates a signed session cookie that can be verified", async () => {
    const cookie = await createSessionCookieValue();
    await expect(verifySessionCookieValue(cookie)).resolves.toBe(true);
  });

  it("rejects a tampered session cookie", async () => {
    const cookie = await createSessionCookieValue();
    await expect(verifySessionCookieValue(`${cookie}tampered`)).resolves.toBe(false);
  });

  it("expires session cookies after the configured max age", async () => {
    const cookie = await createSessionCookieValue();
    vi.advanceTimersByTime((SESSION_MAX_AGE_SECONDS + 1) * 1000);
    await expect(verifySessionCookieValue(cookie)).resolves.toBe(false);
  });

  it("rejects a missing session cookie when protection is enabled", async () => {
    await expect(verifySessionCookieValue(undefined)).resolves.toBe(false);
  });

  it("sanitizes unsafe redirect targets", () => {
    expect(safeRedirectPath("/dashboard")).toBe("/dashboard");
    expect(safeRedirectPath("//evil.example")).toBe("/");
    expect(safeRedirectPath("https://evil.example")).toBe("/");
    expect(safeRedirectPath("/api/github/summary")).toBe("/");
  });

  it("defaults repository details to visible when protection is enabled", () => {
    expect(shouldShowRepositoryDetails()).toBe(true);
  });

  it("allows repository details to be disabled explicitly", () => {
    process.env.SHOW_REPOSITORY_DETAILS = "false";
    expect(shouldShowRepositoryDetails()).toBe(false);
  });

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
    vi.stubEnv("NODE_ENV", "production");
    process.env.GITHUB_TOKEN = "token";
    process.env.INCLUDE_PRIVATE = "true";
    delete process.env.DASHBOARD_PASSWORD;

    expect(() => assertProtectedDashboardConfigured()).toThrow(/DASHBOARD_PASSWORD/);
  });

  it("allows protected dashboard routes in production when private data is disabled", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.GITHUB_TOKEN = "token";
    process.env.INCLUDE_PRIVATE = "false";
    delete process.env.DASHBOARD_PASSWORD;

    expect(() => assertProtectedDashboardConfigured()).not.toThrow();
  });

  it("allows protected dashboard routes outside production-like runtimes", () => {
    vi.stubEnv("NODE_ENV", "development");
    process.env.GITHUB_TOKEN = "token";
    process.env.INCLUDE_PRIVATE = "true";
    delete process.env.DASHBOARD_PASSWORD;

    expect(() => assertProtectedDashboardConfigured()).not.toThrow();
  });

  it("allows the public language card to be generated without a dashboard password", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.GITHUB_TOKEN = "token";
    process.env.INCLUDE_PRIVATE = "true";
    delete process.env.DASHBOARD_PASSWORD;

    expect(isPublicLanguageCardAllowed()).toBe(true);
  });
});
