# GitHub Dashboard

A privacy-aware GitHub profile dashboard for `bigtomcat6`, built with Next.js App Router.

The MVP focuses on one practical problem: show language and repository statistics that can include private repositories without exposing a GitHub token or private repository names to the browser.

## MVP scope

- Server-side GitHub data fetching only.
- Public profile summary.
- Repository counts, stars, forks, and indexed language bytes.
- Language aggregation across public repositories and, when configured, private repositories.
- Private repository names hidden by default.
- Fixed username configuration to prevent the deployment from becoming a public GitHub stats proxy.
- Password-protected JSON endpoint: `/api/github/summary`.
- Public README-friendly language SVG endpoint: `/api/cards/languages.svg`.
- CI workflow for tests, typecheck, and production build.

## Local development

```bash
corepack enable
pnpm install
cp .env.example .env.local
pnpm dev
```

Open `http://localhost:3000`.

Without `GITHUB_TOKEN`, the dashboard falls back to public repositories only.

## Environment variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `GITHUB_TOKEN` | Optional but required for private repos | empty | Server-side GitHub token. Use a fine-grained PAT with selected repositories and Metadata read access. |
| `GITHUB_USERNAME` | No | `bigtomcat6` | Fixed dashboard owner. |
| `INCLUDE_PRIVATE` | No | `true` | Include private repos when a token is available. |
| `EXPOSE_PRIVATE_REPO_NAMES` | No | `false` | Keep private repo names hidden in API/UI output. |
| `EXCLUDED_REPOS` | No | empty | Comma-separated repo names or `owner/name` values to exclude. |
| `INCLUDE_FORKS` | No | `false` | Include forks in stats/language aggregation. |
| `GITHUB_REPO_AFFILIATION` | No | `owner` | Repo affiliation used for `/user/repos` when authenticated. |
| `DASHBOARD_REVALIDATE_SECONDS` | No | `86400` | Cache/revalidation period. |
| `DASHBOARD_PASSWORD` | Required in production when private dashboard data is enabled | empty | Password that protects the dashboard page and JSON summary route. |
| `DASHBOARD_SESSION_SECRET` | Recommended in production | falls back to `DASHBOARD_PASSWORD` | HMAC signing secret for dashboard session cookies. Use a long random value. |
| `SHOW_REPOSITORY_DETAILS` | No | `true` when password protection is enabled | Controls repository-level detail visibility inside the protected dashboard. |

## API endpoints

### `GET /api/github/summary`

Returns the dashboard JSON payload. This endpoint is protected when `DASHBOARD_PASSWORD` is set and returns no-store cache headers. Private repository names are masked unless `EXPOSE_PRIVATE_REPO_NAMES=true`.

### `GET /api/cards/languages.svg`

Returns an intentionally public SVG language card suitable for a GitHub profile README. The SVG output is limited to aggregate language names and percentages.

```md
![GitHub languages](https://your-deployment.vercel.app/api/cards/languages.svg)
```

## Deployment notes

For Vercel:

1. Import this repository.
2. Add `GITHUB_TOKEN` in Environment Variables.
3. Keep `GITHUB_USERNAME=bigtomcat6`.
4. Keep `EXPOSE_PRIVATE_REPO_NAMES=false` unless you intentionally want private names in output.
5. Set `DASHBOARD_PASSWORD` before enabling private dashboard data in production.
6. Set `DASHBOARD_SESSION_SECRET` to a long random value.
7. Deploy.

## Security model

This project intentionally does not support `?username=...` on the public API. The dashboard is configured for a fixed owner to avoid letting other people use your Vercel deployment as a public GitHub stats service.

The public/private boundary is route-specific:

- `/api/cards/languages.svg` is intentionally public and CDN-cacheable. It must only expose aggregate language names and percentages.
- `/` and `/api/github/summary` are protected when `DASHBOARD_PASSWORD` is set and return no-store headers.
- In Vercel production, private dashboard data requires `DASHBOARD_PASSWORD`; otherwise protected routes fail closed instead of rendering repository-level data.
- GitHub fetches may use Next/Vercel Data Cache to reduce API and function cost, but protected HTTP responses are not shared-cacheable.
