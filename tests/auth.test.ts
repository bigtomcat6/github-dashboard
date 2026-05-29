import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyDashboardPassword, createSessionCookieValue, verifySessionCookieValue, SESSION_MAX_AGE_SECONDS } from '@/lib/auth';

vi.useFakeTimers();

describe('Dashboard Auth', () => {
  beforeEach(() => {
    process.env.DASHBOARD_PASSWORD = 'test123';
  });

  it('should verify correct password', async () => {
    const valid = await verifyDashboardPassword('test123');
    expect(valid).toBe(true);
  });

  it('should reject wrong password', async () => {
    const valid = await verifyDashboardPassword('wrong');
    expect(valid).toBe(false);
  });

  it('should create and verify session cookie', async () => {
    const cookie = await createSessionCookieValue();
    const valid = await verifySessionCookieValue(cookie);
    expect(valid).toBe(true);
  });

  it('should expire session cookie after max age', async () => {
    const cookie = await createSessionCookieValue();
    vi.advanceTimersByTime((SESSION_MAX_AGE_SECONDS + 1) * 1000);
    const valid = await verifySessionCookieValue(cookie);
    expect(valid).toBe(false);
  });

  it('should fail for undefined session cookie', async () => {
    const valid = await verifySessionCookieValue(undefined);
    expect(valid).toBe(false);
  });
});
