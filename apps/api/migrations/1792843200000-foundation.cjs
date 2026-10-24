exports.up = pgm => pgm.sql(`
  CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL CONSTRAINT users_email_key UNIQUE,
    password_hash text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CHECK (email = lower(btrim(email)) AND length(email) BETWEEN 3 AND 254)
  );
  CREATE TABLE workspaces (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id uuid NOT NULL UNIQUE REFERENCES users(id),
    name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 100),
    currency text NOT NULL DEFAULT 'GBP' CHECK (currency = 'GBP'),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (id, owner_user_id)
  );
  CREATE TABLE sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id),
    token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    expires_at timestamptz NOT NULL DEFAULT (clock_timestamp() + interval '30 minutes'),
    revoked_at timestamptz,
    CHECK (expires_at > created_at)
  );
  CREATE INDEX sessions_user_id_idx ON sessions(user_id);
  CREATE INDEX sessions_expiry_idx ON sessions(expires_at);
  CREATE TABLE bank_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id),
    name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 100),
    currency text NOT NULL DEFAULT 'GBP' CHECK (currency = 'GBP'),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (workspace_id, id), UNIQUE (workspace_id, name)
  );
  CREATE TABLE import_batches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id),
    bank_account_id uuid,
    kind text NOT NULL CHECK (kind IN ('invoices', 'transactions')),
    file_hash text NOT NULL CHECK (file_hash ~ '^[a-f0-9]{64}$'),
    status text NOT NULL CHECK (status IN ('completed', 'rejected')),
    row_count integer NOT NULL CHECK (row_count >= 0),
    inserted_count integer NOT NULL CHECK (inserted_count >= 0 AND inserted_count <= row_count),
    duplicate_count integer NOT NULL CHECK (duplicate_count >= 0 AND inserted_count + duplicate_count <= row_count),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (workspace_id, id),
    FOREIGN KEY (workspace_id, bank_account_id) REFERENCES bank_accounts(workspace_id, id),
    CHECK ((kind = 'invoices' AND bank_account_id IS NULL) OR (kind = 'transactions' AND bank_account_id IS NOT NULL))
  );
  CREATE UNIQUE INDEX import_batches_completed_file_key ON import_batches(workspace_id, kind, bank_account_id, file_hash) NULLS NOT DISTINCT WHERE status = 'completed';
  CREATE TABLE import_errors (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id),
    batch_id uuid NOT NULL,
    row_number integer CHECK (row_number > 0),
    field text,
    message text NOT NULL,
    FOREIGN KEY (workspace_id, batch_id) REFERENCES import_batches(workspace_id, id)
  );
  CREATE TABLE invoices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id),
    import_batch_id uuid,
    invoice_number text NOT NULL CHECK (length(btrim(invoice_number)) > 0),
    customer_name text NOT NULL CHECK (length(btrim(customer_name)) > 0),
    issue_date date NOT NULL, due_date date NOT NULL,
    currency text NOT NULL DEFAULT 'GBP' CHECK (currency = 'GBP'),
    total_pence bigint NOT NULL CHECK (total_pence >= 0),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (workspace_id, id), UNIQUE (workspace_id, invoice_number),
    CHECK (due_date >= issue_date),
    FOREIGN KEY (workspace_id, import_batch_id) REFERENCES import_batches(workspace_id, id)
  );
  CREATE TABLE bank_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id),
    bank_account_id uuid NOT NULL,
    import_batch_id uuid,
    transaction_date date NOT NULL,
    description text NOT NULL,
    amount_pence bigint NOT NULL CHECK (amount_pence > 0),
    currency text NOT NULL DEFAULT 'GBP' CHECK (currency = 'GBP'),
    external_transaction_id text CHECK (external_transaction_id IS NULL OR length(btrim(external_transaction_id)) > 0),
    payment_reference text, payer_name text,
    requires_duplicate_review boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (workspace_id, id), UNIQUE (workspace_id, bank_account_id, external_transaction_id),
    FOREIGN KEY (workspace_id, bank_account_id) REFERENCES bank_accounts(workspace_id, id),
    FOREIGN KEY (workspace_id, import_batch_id) REFERENCES import_batches(workspace_id, id)
  );
  CREATE TABLE match_suggestions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id),
    bank_transaction_id uuid NOT NULL, invoice_id uuid NOT NULL,
    suggested_pence bigint NOT NULL CHECK (suggested_pence > 0),
    category text NOT NULL CHECK (category IN ('exact_reference', 'strong', 'possible', 'ambiguous')),
    evidence jsonb NOT NULL, warnings jsonb NOT NULL,
    explanation text NOT NULL,
    review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'rejected', 'confirmed', 'stale')),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (workspace_id, id),
    FOREIGN KEY (workspace_id, bank_transaction_id) REFERENCES bank_transactions(workspace_id, id),
    FOREIGN KEY (workspace_id, invoice_id) REFERENCES invoices(workspace_id, id)
  );
  CREATE TABLE financial_operations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id),
    operation_key uuid NOT NULL,
    kind text NOT NULL CHECK (kind IN ('allocation', 'reversal')),
    request_hash text NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
    result jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (workspace_id, id), UNIQUE (workspace_id, operation_key)
  );
  CREATE TABLE payment_allocations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id),
    operation_id uuid NOT NULL, bank_transaction_id uuid NOT NULL, invoice_id uuid NOT NULL,
    amount_pence bigint NOT NULL CHECK (amount_pence > 0),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (workspace_id, id), UNIQUE (operation_id, bank_transaction_id, invoice_id),
    FOREIGN KEY (workspace_id, operation_id) REFERENCES financial_operations(workspace_id, id),
    FOREIGN KEY (workspace_id, bank_transaction_id) REFERENCES bank_transactions(workspace_id, id),
    FOREIGN KEY (workspace_id, invoice_id) REFERENCES invoices(workspace_id, id)
  );
  CREATE TABLE allocation_reversals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id),
    allocation_id uuid NOT NULL UNIQUE, operation_id uuid NOT NULL,
    reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 1000),
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    UNIQUE (workspace_id, id),
    FOREIGN KEY (workspace_id, allocation_id) REFERENCES payment_allocations(workspace_id, id),
    FOREIGN KEY (workspace_id, operation_id) REFERENCES financial_operations(workspace_id, id)
  );
  CREATE TABLE audit_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id uuid NOT NULL REFERENCES workspaces(id),
    actor_user_id uuid NOT NULL,
    operation_id uuid,
    event_type text NOT NULL,
    details jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    FOREIGN KEY (workspace_id, operation_id) REFERENCES financial_operations(workspace_id, id),
    FOREIGN KEY (workspace_id, actor_user_id) REFERENCES workspaces(id, owner_user_id)
  );
  CREATE INDEX invoices_workspace_idx ON invoices(workspace_id);
  CREATE INDEX transactions_workspace_idx ON bank_transactions(workspace_id);
  CREATE INDEX allocations_invoice_idx ON payment_allocations(workspace_id, invoice_id);
  CREATE INDEX allocations_transaction_idx ON payment_allocations(workspace_id, bank_transaction_id);
  CREATE INDEX audit_workspace_idx ON audit_events(workspace_id, created_at);
`);
exports.down = pgm => pgm.sql(`
  DROP TABLE audit_events, allocation_reversals, payment_allocations, financial_operations,
    match_suggestions, bank_transactions, invoices, import_errors, import_batches,
    bank_accounts, sessions, workspaces, users;
`);
