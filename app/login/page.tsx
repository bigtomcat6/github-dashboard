import { isDashboardProtectionEnabled, safeRedirectPath } from "@/lib/auth";
import { redirect } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams?: Promise<{
    next?: string;
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  if (!isDashboardProtectionEnabled()) {
    redirect("/");
  }

  const params = (await searchParams) || {};
  const nextPath = safeRedirectPath(params.next || "/");
  const hasError = params.error === "1";

  return (
    <main className="shell auth-shell">
      <section className="card auth-card">
        <p className="eyebrow">Protected dashboard</p>
        <h1>Sign in</h1>
        <p className="muted">Enter the dashboard password to view the private GitHub repository breakdown.</p>

        <form className="auth-form" action="/api/auth/login" method="post">
          <input type="hidden" name="next" value={nextPath} />
          <label htmlFor="password">Dashboard password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required autoFocus />
          {hasError && <p className="form-error">Password was not accepted.</p>}
          <button type="submit">Unlock dashboard</button>
        </form>
      </section>
    </main>
  );
}
