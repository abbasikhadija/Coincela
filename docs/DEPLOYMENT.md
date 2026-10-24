# Deployment preparation

No public deployment or provider resources have been verified. Milestone 0 does not require Render/Neon credentials.

GitHub Pages: place this project at a dedicated Coincela repository root, use a main branch, and choose Settings → Pages → GitHub Actions. `.github/workflows/ci-pages.yml` runs install, typecheck, lint, unit/API tests, isolated PostgreSQL integration, migration command, production builds and Playwright before the deployment job can run. It uses official configure-pages/upload-pages-artifact/deploy-pages actions. Pull requests verify without deploying. Deployment requires Pages permissions and the github-pages environment. Set repository variable VITE_API_URL to the eventual HTTPS Render URL; leaving it empty publishes a shell that explicitly reports unconfigured connectivity. `/Coincela/` is case-sensitive; change Vite base if repository name changes.

Render later: root install `npm ci`; build `npm run build -w @coincela/api`; start `npm run start -w @coincela/api`. Configure NODE_ENV=production, PORT provided by host, DATABASE_URL and CORS_ORIGINS=https://USERNAME.github.io (no path or trailing slash). Public health `/health`, readiness `/health/ready`. No persistent local filesystem is required. Verify actual HTTPS health after provisioning.

Neon later: keep DATABASE_URL server-side only, require verified TLS (`sslmode=verify-full`), use provider-recommended connection limits, and apply reviewed migrations once through a controlled release step using `npm run db:migrate`. Never use CI database credentials in production. Milestone 1 adds the initial authentication/workspace/financial schema migration; review DATABASE.md and do not roll it back against real data.

Milestone 1 auth uses Authorization bearer headers, no cookies. CORS must include the exact frontend origin (never /Coincela/ in that origin), permit Authorization preflight and reject other origins. Sessions expire after 30 minutes or logout; auth responses are no-store. Assess the deployment provider's trusted proxy configuration and per-process IP limits before public scaling; forwarded IPs are deliberately untrusted by default. Browser tests use an isolated DB and API port 3002.

The expected eventual frontend URL is https://USERNAME.github.io/Coincela/; this is a template, not a live demo. Verify browser navigation/refresh, public API connectivity, CORS and the full financial workflow before claiming final deployment success.

Milestone 2 uploads raw text/csv (not multipart). Allow Content-Type, Authorization and X-Bank-Account-Id preflight headers for configured origins. The application enforces a 1 MiB decoded body limit; configure any upstream proxy to allow that size. Sample CSVs are bundled under /Coincela/samples/. Raw uploads never require persistent filesystem storage. Existing initial schema supports imports without another migration.

Milestone 3 requires applying 1792843300000-matching-runs.cjs before serving matching requests. Existing build/start commands and CORS/token configuration remain unchanged. Matching stores PostgreSQL review metadata only; it needs no filesystem service or extra credentials. No public hosted matching workflow has been verified.
# Milestone 4 deployment note

The allocation API uses the existing migrations; apply normal migrations, then build/start the current API. Preserve the operation/allocation/audit tables as one financial record set. Do not truncate operation records to clear retries. No credentials or hosting changes are introduced by M4. The test build's https://api.coincela.test is local test transport only; rebuild with the real public HTTPS API URL or empty configuration afterward. PostgreSQL lock-timeout conflicts are retryable with the same confirmation payload/key. No public deployment or hosted CI verification was performed for this milestone.

## Milestone 5 deployment note

Reversals and Activity use the existing migrations and deployment configuration. No new credentials, infrastructure or client secrets are needed. Preserve reversal rows and their reasons alongside original allocations/operations/audits. Retrying an uncertain response must retain the same operation key/reason; do not clear financial operation records. Build/deploy the API and frontend together to expose the protected history/reversal routes. Public HTTPS deployment and hosted CI remain unverified; later production review must assess database privileges and backup/recovery for preserved history.

## Milestone 6 deployment note

The public landing is implemented locally, not publicly deployed or verified. HashRouter retains /Coincela/#/ compatibility for invoice/payment details and workspace navigation; synthetic samples use the configured Vite base. Deploy the API/frontend together for /overview and record-detail reads. No new environment values, credentials, migrations or infrastructure are needed. Production builds must use the real HTTPS API URL or empty configuration, never the test-only hostname. Hosted CI, live URLs, M7 reliability review and production smoke testing remain unverified.
