# Migrations

Run npm run db:migrate from project root. DATABASE_URL (or apps/api/.env) selects the target database; timestamped CommonJS .cjs migrations live in apps/api/migrations. node-pg-migrate manages history, transactions and advisory locking.

The initial Milestone 1 migration creates authentication, workspaces and required financial entities. See DATABASE.md for constraints and current limits.

npm run db:rollback reverts the latest migration. The initial migration rollback drops all domain tables and destroys their data. Automated rollback checks use a disposable random schema. Never roll back production without reviewing data loss and recovery.

Future migrations need unique increasing timestamps and reviewed up/down exports. Do not edit a migration already released to a shared/production database; add another migration. The current initial migration has not been deployed publicly.
