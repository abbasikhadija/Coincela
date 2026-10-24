exports.up = pgm => pgm.sql(`
  CREATE TABLE matching_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id),
    bank_transaction_id uuid NOT NULL,
    snapshot_hash text NOT NULL CHECK (snapshot_hash ~ '^[a-f0-9]{64}$'),
    outcome text NOT NULL CHECK (outcome IN ('exact_reference','strong','possible','ambiguous','no_match')),
    explanation text NOT NULL, warnings jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (workspace_id,id), UNIQUE (workspace_id,bank_transaction_id,snapshot_hash),
    FOREIGN KEY (workspace_id,bank_transaction_id) REFERENCES bank_transactions(workspace_id,id)
  );
  ALTER TABLE match_suggestions ADD COLUMN run_id uuid;
  ALTER TABLE match_suggestions ADD COLUMN position integer NOT NULL DEFAULT 0 CHECK (position >= 0);
  ALTER TABLE match_suggestions ADD CONSTRAINT suggestions_run_fk FOREIGN KEY (workspace_id,run_id) REFERENCES matching_runs(workspace_id,id);
  ALTER TABLE match_suggestions ADD CONSTRAINT suggestions_run_invoice_key UNIQUE (run_id,invoice_id);
  CREATE INDEX matching_runs_payment_idx ON matching_runs(workspace_id,bank_transaction_id,created_at);
`);
exports.down = pgm => pgm.sql(`
  DELETE FROM match_suggestions WHERE run_id IS NOT NULL;
  ALTER TABLE match_suggestions DROP CONSTRAINT suggestions_run_fk;
  ALTER TABLE match_suggestions DROP CONSTRAINT suggestions_run_invoice_key;
  ALTER TABLE match_suggestions DROP COLUMN run_id;
  ALTER TABLE match_suggestions DROP COLUMN position;
  DROP TABLE matching_runs;
`);
