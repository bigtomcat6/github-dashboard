import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  SESSION_MAX_AGE_SECONDS,
  createSessionCookieValue,
  safeRedirectPath,
  shouldShowRepositoryDetails,
  verifyDashboardPassword,
  verifySessionCookieValue,
} from "../lib/auth";

vi.useFakeTimers();

describe("dashboard auth helpers", () => {
  beforeEach(() => {
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    process.env.DASHBOARD_PASSWORD = "test-password";
    delete process.env.SHOW_REPOSITORY_DETAILS;
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
});
