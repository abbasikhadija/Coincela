# Deployment preparation

No public deployment or provider resources have been verified. Milestone 0 does not require Render/Neon credentials.

GitHub Pages: place this project at a dedicated Coincela repository root, use a main branch, and choose Settings → Pages → GitHub Actions. `.github/workflows/ci-pages.yml` runs install, typecheck, lint, unit/API tests, isolated PostgreSQL integration, migration command, production builds and Playwright before the deployment job can run. It uses official configure-pages/upload-pages-artifact/deploy-pages actions. Pull requests verify without deploying. Deployment requires Pages permissions and the github-pages environment. Set repository variable VITE_API_URL to the eventual HTTPS Render URL; leaving it empty publishes a shell that explicitly reports unconfigured connectivity. `/Coincela/` is case-sensitive; change Vite base if repository name changes.

Render later: root install `npm ci`; build `npm run build -w @coincela/api`; start `npm run start -w @coincela/api`. Configure NODE_ENV=production, PORT provided by host, DATABASE_URL and CORS_ORIGINS=https://USERNAME.github.io (no path or trailing slash). Public health `/health`, readiness `/health/ready`. No persistent local filesystem is required. Verify actual HTTPS health after provisioning.

Neon later: keep DATABASE_URL server-side only, require verified TLS (`sslmode=verify-full`), use provider-recommended connection limits, and apply reviewed migrations once through a controlled release step using `npm run db:migrate`. Never use CI database credentials in production. No domain migrations exist in Milestone 0.

The expected eventual frontend URL is https://USERNAME.github.io/Coincela/; this is a template, not a live demo. Verify browser navigation/refresh, public API connectivity, CORS and the full financial workflow before claiming final deployment success.
