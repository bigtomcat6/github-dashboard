export const AUTH_COOKIE_NAME = "github_dashboard_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

const SESSION_VERSION = "v1";
const encoder = new TextEncoder();

export function isDashboardProtectionEnabled() {
  return dashboardPassword().length > 0;
}

export function shouldShowRepositoryDetails() {
  return parseBool(process.env.SHOW_REPOSITORY_DETAILS, isDashboardProtectionEnabled());
}

export function noStoreHeaders(): HeadersInit {
  return {
    "Cache-Control": "private, no-store, max-age=0",
  };
}

export async function verifyDashboardPassword(input: string) {
  const expected = dashboardPassword();
  if (!expected) return false;
  return secureCompare(input, expected);
}

export async function createSessionCookieValue(now = Date.now()) {
  const payload = `${SESSION_VERSION}.${now}`;
  const signature = await sign(payload);
  return `${payload}.${signature}`;
}

export async function verifySessionCookieValue(value?: string) {
  if (!isDashboardProtectionEnabled()) return true;
  if (!value) return false;

  const parts = value.split(".");
  if (parts.length !== 3) return false;

  const [version, createdAt, signature] = parts;
  if (version !== SESSION_VERSION) return false;

  const createdAtMs = Number(createdAt);
  if (!Number.isFinite(createdAtMs)) return false;

  const now = Date.now();
  if (createdAtMs > now + 60_000) return false;
  if (now - createdAtMs > SESSION_MAX_AGE_SECONDS * 1000) return false;

  const expectedSignature = await sign(`${version}.${createdAt}`);
  return secureCompare(signature, expectedSignature);
}

export function safeRedirectPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  if (value.startsWith("/api/")) return "/";
  return value;
}

function dashboardPassword() {
  return process.env.DASHBOARD_PASSWORD?.trim() || "";
}

function sessionSecret() {
  return process.env.DASHBOARD_SESSION_SECRET?.trim() || dashboardPassword();
}

function parseBool(value: string | undefined, fallback: boolean) {
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

async function sign(payload: string) {
  const secret = sessionSecret();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return base64Url(signature);
}

async function secureCompare(left: string, right: string) {
  const [leftDigest, rightDigest] = await Promise.all([sha256(left), sha256(right)]);
  let diff = leftDigest.length ^ rightDigest.length;
  const length = Math.max(leftDigest.length, rightDigest.length);

  for (let i = 0; i < length; i += 1) {
    diff |= (leftDigest[i] || 0) ^ (rightDigest[i] || 0);
  }

  return diff === 0;
}

async function sha256(value: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

function base64Url(value: ArrayBuffer) {
  const bytes = new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
