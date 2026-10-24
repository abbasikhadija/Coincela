# Migrations

Run npm run db:migrate from project root. DATABASE_URL (or apps/api/.env) selects the target database; timestamped CommonJS .cjs migrations live in apps/api/migrations. node-pg-migrate manages history, transactions and advisory locking.

The initial Milestone 1 migration creates authentication, workspaces and required financial entities. See DATABASE.md for constraints and current limits.

npm run db:rollback reverts the latest migration. The initial migration rollback drops all domain tables and destroys their data. Automated rollback checks use a disposable random schema. Never roll back production without reviewing data loss and recovery.

Future migrations need unique increasing timestamps and reviewed up/down exports. Do not edit a migration already released to a shared/production database; add another migration. The current initial migration has not been deployed publicly.

Milestone 3 adds 1792843300000-matching-runs.cjs. Apply it with npm run db:migrate before starting the matching API. It creates matching_runs and adds scoped run references/position to match_suggestions. Rolling it down deletes generated review metadata from this migration and drops its extension columns/table; it does not mutate invoices, bank transactions, allocations or reversals. Initial migration down remains destructive to domain data. Integration round-trip tests apply, roll back and reapply both migrations in disposable schemas.
