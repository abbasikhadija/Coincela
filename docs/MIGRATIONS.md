# Migrations

Run `npm run db:migrate` from the repository root. Configuration uses DATABASE_URL and `apps/api/migrations`. Create timestamped CommonJS `.cjs` migrations there exporting `up` and `down`, using node-pg-migrate's migration builder. The runner manages transactions and its migration history table. `npm run db:rollback` reverts the latest migration; never run against production without reviewing data loss.

Milestone 0 intentionally has no domain migrations. Users, sessions and financial tables begin in Milestone 1. A no-op migration run may initialize the runner's metadata table only.
