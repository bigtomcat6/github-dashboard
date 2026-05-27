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
- Cached JSON endpoint: `/api/github/summary`.
- README-friendly SVG endpoint: `/api/cards/languages.svg`.
- CI workflow for typecheck and production build.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
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

## API endpoints

### `GET /api/github/summary`

Returns the dashboard JSON payload. Private repository names are masked unless `EXPOSE_PRIVATE_REPO_NAMES=true`.

### `GET /api/cards/languages.svg`

Returns an SVG language card suitable for a GitHub profile README:

```md
![GitHub languages](https://your-deployment.vercel.app/api/cards/languages.svg)
```

## Deployment notes

For Vercel:

1. Import this repository.
2. Add `GITHUB_TOKEN` in Environment Variables.
3. Keep `GITHUB_USERNAME=bigtomcat6`.
4. Keep `EXPOSE_PRIVATE_REPO_NAMES=false` unless you intentionally want private names in output.
5. Deploy.

## Security model

This project intentionally does not support `?username=...` on the public API. The dashboard is configured for a fixed owner to avoid letting other people use your Vercel deployment as a public GitHub stats service.
