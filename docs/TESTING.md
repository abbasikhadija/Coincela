# Testing

From project root after `npm ci`:

1. `npm test`: API/environment Vitest + Supertest; UI/rendering and API client Vitest + Testing Library.
2. `npm run typecheck` and `npm run lint`.
3. `npm run test:integration` with TEST_DATABASE_URL pointing to an isolated PostgreSQL database. Missing configuration fails rather than silently skipping. Checks real SQL connectivity and readiness.
4. `npm run db:migrate` with DATABASE_URL pointing to that database. No domain migrations yet.
5. `npm run build` for both applications.
6. `npx playwright install chromium`; build frontend with test API URL as described below, then `npm run test:e2e` against production preview and a real API listener. Desktop/mobile Chromium cover asset paths, hash navigation/refresh, active link, no overflow, keyboard skip link, network failure and retry.

Production client requires HTTPS. For E2E, set VITE_API_URL=https://api.coincela.test before `npm run build`. Playwright forwards this test-only hostname to the real local Express process using route.fetch, preserving the actual HTTP response. The unavailable test temporarily aborts the request and then removes that override. Deployment artifacts must always be rebuilt with the real public VITE_API_URL or empty value. Browser connectivity tests verify API liveness; the separate integration test verifies PostgreSQL readiness.

CI uses PostgreSQL 18 as an isolated service. Local standard setup uses Docker Compose. In this environment native PostgreSQL 18 is used on loopback port 55432 because Docker is absent. Do not point integration or migration checks at real customer data. Financial/concurrency tests are not applicable until their milestones. Actual latest results and limitations are in STATUS.md.
