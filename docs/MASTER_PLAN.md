# COINCELA — MASTER SOFTWARE ENGINEERING DEVELOPMENT DIRECTIVE

## YOUR ROLE

Act as a senior full-stack software engineer, backend architect, PostgreSQL specialist, financial systems engineer, test engineer, product designer, interaction designer, and UX researcher.

You are responsible for progressively developing **Coincela**, a reliable, publicly accessible invoice and payment reconciliation application.

Develop this as a complete, functional, portfolio-quality software engineering project.

Your goal is not to generate large amounts of code or demonstrate as many technologies as possible.

Your goal is to deliver a small, carefully engineered application that solves a practical problem, protects financial correctness, and provides an exceptionally understandable user experience.

The finished application must be functional, tested, documented, and accessible online.

---

# 1. PROJECT IDENTITY

**Name:** Coincela

**Tagline:** Every payment accounted for.

**Category:** Invoice and payment reconciliation.

**Target users:** Freelancers, consultants, and small service businesses that manage invoices and bank transfers using spreadsheets.

## Core Problem

Small businesses frequently maintain two separate sources of financial information:

1. Outstanding customer invoices.
2. Incoming bank transactions.

Determining which payment belongs to which invoice becomes difficult when:

* Customers make partial payments.
* Multiple payments belong to the same invoice.
* One bank transfer covers several invoices.
* Payment references are incorrect or missing.
* Customers have multiple outstanding invoices.
* Transaction records are duplicated.
* Multiple invoices have identical amounts.

Manual reconciliation is time-consuming and creates opportunities for financial mistakes.

## Core Solution

Coincela allows users to:

1. Import invoice records from CSV files.
2. Import incoming bank transactions from CSV files.
3. Validate and normalize financial records.
4. Identify possible payment-to-invoice matches.
5. Review explainable reconciliation suggestions.
6. Confirm or reject suggested matches.
7. Allocate payments to invoices.
8. Track outstanding balances.
9. Reverse incorrect allocations.
10. Review a complete audit history.

The application must never silently allocate money to the wrong invoice.

All financial allocations require explicit user confirmation.

Coincela is a reconciliation workspace, not a bank, payment processor, or complete accounting system.

---

# 2. PRODUCT AND ENGINEERING PHILOSOPHY

Follow these principles throughout development:

1. Solve the user's actual problem.
2. Financial correctness takes priority over convenience.
3. Prefer clarity over complexity.
4. Never silently reconcile ambiguous payments.
5. Keep the architecture understandable.
6. Write maintainable, explicit code.
7. Design for ordinary users rather than technical experts.
8. Test important behavior, especially failure scenarios.
9. Prefer deterministic matching rules over speculative AI.
10. Maintain honest documentation of implemented capabilities.
11. Keep the application visually calm.
12. Reveal complexity only when necessary.
13. Treat accessibility as a functional requirement.
14. Treat production deployment as part of development.
15. Ensure every milestone produces a verifiable result.

Avoid unnecessary:

* Microservices.
* Kubernetes.
* Redis.
* Message brokers.
* Complex event-driven architectures.
* Machine learning.
* Blockchain.
* Elaborate abstraction layers.
* Decorative UI components.
* Large frontend dependencies.

Use a modular monolith.

Introduce additional infrastructure only when an actual requirement justifies it.

---

# 3. REQUIRED TECHNOLOGY STACK

## Frontend

* React.
* TypeScript.
* Vite.
* Tailwind CSS.
* React Router.
* Accessible reusable UI components.

Use `HashRouter` for GitHub Pages compatibility.

## Backend

* Node.js.
* Express.
* TypeScript.
* Zod for input validation.
* `pg` for PostgreSQL access.
* `node-pg-migrate` for schema migrations.
* `csv-parse` for CSV processing.

Use parameterized SQL queries.

Keep HTTP routing, validation, business logic, and database access logically separated.

## Database

PostgreSQL.

Use explicit database transactions for financial mutations.

Use database constraints and row-level locking where necessary.

## Testing

* Vitest for unit tests.
* Supertest for API tests.
* PostgreSQL-backed integration tests.
* Playwright for end-to-end testing.

## Infrastructure

* npm workspaces.
* Docker Compose for local PostgreSQL.
* GitHub Actions for CI/CD.

Use compatible, stable dependency versions.

Inspect the environment before installing dependencies.

Do not replace existing working components unnecessarily.

---

# 4. LIVE DEPLOYMENT ARCHITECTURE

Coincela must eventually be publicly accessible as a functional full-stack application.

Use this deployment architecture:

```text
                   USER
                    |
                    v
              GitHub Pages
             React Frontend
                    |
                    | HTTPS API Requests
                    v
                 Render
              Express API
                    |
                    | Secure PostgreSQL Connection
                    v
                  Neon
              PostgreSQL
```

## Frontend Hosting

Deploy React to GitHub Pages.

Expected URL structure:

`https://USERNAME.github.io/Coincela/`

Requirements:

* Correct Vite `base` configuration.
* HashRouter navigation.
* Correct static asset paths.
* Functional navigation after refresh.
* Production API environment configuration.
* No hardcoded localhost URLs.
* Automated GitHub Actions deployment.

Use GitHub Pages' official GitHub Actions deployment mechanism.

## Backend Hosting

Deploy the Node.js/Express backend to Render.

Requirements:

* Production build command.
* Production start command.
* Correct environment variables.
* Public health endpoint.
* Graceful shutdown.
* Secure error handling.
* HTTPS API access.
* Proper CORS configuration.
* Configurable server port.
* No dependency on persistent local filesystem storage.

## Database Hosting

Use Neon PostgreSQL.

Requirements:

* Secure database connection.
* Environment-based credentials.
* Proper migration strategy.
* No hardcoded connection strings.
* No database secrets in frontend code.
* Appropriate production connection handling.

## CI/CD

Configure GitHub Actions to:

1. Install dependencies.
2. Run relevant automated tests.
3. Run TypeScript checks.
4. Run linting.
5. Build the production frontend.
6. Deploy successful frontend builds to GitHub Pages.

Failed checks must prevent deployment.

Configure backend testing to use an isolated PostgreSQL service.

Production deployments must not depend on test database credentials.

A frontend that displays mock data without communicating with the real backend does not satisfy the final project requirements.

---

# 5. AUTHENTICATION AND CROSS-ORIGIN SECURITY

The frontend and backend will run on different origins.

Do not assume traditional cross-site cookies will work reliably.

For this MVP, use short-lived opaque bearer tokens backed by server-side session records.

Authentication requirements:

* Generate cryptographically secure session tokens.
* Store only token hashes in PostgreSQL.
* Send the raw token to the authenticated client.
* Include the token in the `Authorization` header.
* Validate token expiry and revocation on the server.
* Revoke the session on logout.
* Protect all private API endpoints.
* Use strict origin allowlisting for CORS.

Store the active token in browser memory and, for page-refresh continuity, `sessionStorage`.

Do not use long-lived tokens or persistent `localStorage` authentication.

Set a reasonable short session lifetime, initially 30 minutes.

Document that browser-accessible token storage remains exposed to XSS risk and mitigate this through careful output handling, dependency hygiene, and avoidance of unsafe HTML injection.

Implement clear session expiry behavior.

Do not rely on third-party cookies.

Use HTTPS in production.

Never expose authentication secrets, database credentials, or private configuration values in Vite builds.

---

# 6. CORE FUNCTIONAL REQUIREMENTS

Implement this complete user workflow:

```text
Register / Login
       |
       v
Business Workspace
       |
       v
Import Invoices
       |
       v
Import Bank Transactions
       |
       v
Validate Imported Records
       |
       v
Generate Match Suggestions
       |
       v
Review Suggested Matches
       |
       v
Confirm Payment Allocation
       |
       v
Update Derived Balances
       |
       v
View Reconciliation History
```

## Required MVP Capabilities

* User registration and authentication.
* One business workspace per user.
* CSV invoice import.
* CSV bank transaction import.
* Import validation and error reporting.
* Duplicate detection.
* Explainable reconciliation suggestions.
* Manual confirmation of financial allocations.
* Partial payments.
* Multiple payments against one invoice.
* One payment allocated across multiple invoices.
* Transactional balance correctness.
* Concurrency protection.
* Reconciliation reversals.
* Audit history.
* Invoice status tracking.
* Outstanding balance tracking.
* A focused, responsive React interface.
* Sample CSV files.
* Public live deployment.
* Automated tests.

## Out of Scope

Do not build:

* Direct banking API integrations.
* Stripe or other payment gateway integrations.
* Invoice PDF generation.
* An accounting general ledger.
* Automatic payment reminders.
* OCR.
* AI matching.
* Multi-currency reconciliation.
* Currency conversion.
* Multi-user business teams.
* Subscription billing.
* Advanced analytics.
* Enterprise accounting features.

Support GBP only.

Keep the MVP deliberately narrow.

---

# 7. CRITICAL FINANCIAL CORRECTNESS RULES

These requirements are nonnegotiable.

## Money Representation

Represent money as integer pence.

Never use JavaScript floating-point arithmetic for financial calculations.

Use PostgreSQL BIGINT where appropriate.

Handle JavaScript BigInt serialization explicitly.

Use decimal strings or string-encoded integer minor units at API boundaries.

Do not silently convert unsafe large integers into JavaScript numbers.

Reject:

* Invalid financial amounts.
* Unsupported decimal precision.
* Negative invoice totals.
* Zero or negative allocation amounts.
* Unsupported currencies.
* Numeric overflow.
* Malformed input.

## Invoice Balances

For every invoice:

```text
Outstanding Balance =
Invoice Total - Sum(Active Allocations)
```

Always enforce:

```text
0 <= Outstanding Balance <= Invoice Total
```

## Bank Transaction Balances

For every incoming bank transaction:

```text
Unallocated Amount =
Transaction Amount - Sum(Active Allocations)
```

Always enforce:

```text
0 <= Unallocated Amount <= Transaction Amount
```

## Allocation Rules

Every allocation must:

1. Belong to the correct workspace.
2. Reference an existing invoice.
3. Reference an existing incoming bank transaction.
4. Allocate a strictly positive amount.
5. Never exceed the invoice's outstanding balance.
6. Never exceed the bank transaction's unallocated amount.
7. Commit atomically with its audit event.
8. Remain correct during concurrent requests.

Do not store editable invoice balances as the sole source of truth.

Derive balances from allocation and reversal records.

## Concurrency

Use PostgreSQL transactions and row-level locking.

For financial operations, follow one consistent locking order:

1. Lock the relevant bank transaction.
2. Lock affected invoices in deterministic identifier order.
3. Recalculate current balances.
4. Validate the requested allocation.
5. Persist allocations and audit events.
6. Commit.

For operations involving multiple transactions or invoices, extend this ordering consistently.

Use the same locking policy for reversals.

Document transaction boundaries.

Never trust balances calculated before acquiring the required locks.

## Reversals

Incorrect allocations must be reversible.

Do not delete the original allocation.

Store a reversal record referencing the original allocation.

Require a reversal reason.

Each allocation may be reversed only once.

Reversals must atomically restore available balances and create audit events.

## Idempotency

Repeated API requests must not duplicate financial effects.

Use operation identifiers and appropriate database constraints.

Retries with the same identifier and identical payload must return the existing outcome.

Retries with the same identifier and a conflicting payload must be rejected.

---

# 8. CSV IMPORT DESIGN

Implement two documented import formats.

## Invoice CSV

Required columns:

```text
invoice_number
customer_name
issue_date
due_date
currency
total_amount
```

## Bank Transaction CSV

Required columns:

```text
transaction_date
description
amount
currency
```

Optional columns:

```text
external_transaction_id
payment_reference
payer_name
```

Bank transactions must belong to a selected named bank account.

Only positive incoming credits are eligible for reconciliation.

Refunds, withdrawals, and outgoing payments remain outside MVP allocation functionality.

## Import Requirements

* Validate file structure.
* Validate required columns.
* Validate financial amounts.
* Validate dates.
* Support correctly quoted CSV fields.
* Handle escaped characters.
* Report row-level errors.
* Enforce upload size limits.
* Enforce row count limits.
* Record import batches.
* Record import outcomes.
* Prevent duplicate financial effects.

Use an explicit import policy.

Recommended policy:

1. Parse and validate the complete bounded upload before committing.
2. Reject malformed imports without partial financial insertion.
3. Treat confidently identified existing records as explicit duplicates.
4. Report skipped duplicates.
5. Commit valid new records and import metadata atomically.
6. Preserve meaningful import history.

Do not silently discard potentially legitimate transactions.

Two bank transfers can have identical dates, descriptions, and amounts.

Identical visible fields alone are not proof of duplication.

Use reliable external transaction identifiers when available.

Recognize exact repeated file uploads using file hashes.

Treat uncertain duplicate candidates as records requiring review.

---

# 9. RECONCILIATION ENGINE

Implement deterministic, explainable reconciliation suggestions.

The engine should consider:

* Invoice reference.
* Payment reference.
* Customer name.
* Payer name.
* Invoice amount.
* Outstanding balance.
* Transaction amount.
* Transaction date.
* Invoice dates.

## Matching Outcomes

Use understandable categories:

* Exact reference match.
* Strong candidate.
* Possible candidate.
* Ambiguous.
* No match.

Do not invent numerical confidence percentages.

## Important Rules

Exact invoice references receive priority.

Amount-only matches are insufficient for automatic allocation.

When several invoices are plausible, identify ambiguity.

When a transaction exceeds the outstanding invoice balance, do not silently allocate the excess.

Unmatched payments are valid outcomes.

A suggestion must explain why it was generated.

## Required Suggestion Information

Each suggestion should provide:

* Bank transaction.
* Candidate invoice.
* Suggested allocation amount.
* Supporting evidence.
* Relevant warnings.
* Explanation.
* Review status.

## Separation of Responsibilities

The matching engine generates suggestions.

The allocation service commits financial decisions.

These must be separate components.

Generating suggestions must not alter financial balances.

Users must explicitly confirm allocations.

When confirming a suggestion, revalidate current financial state inside a database transaction.

Stale suggestions must not bypass financial constraints.

---

# 10. DATABASE AND BACKEND ARCHITECTURE

Use a modular monolith.

Suggested backend modules:

```text
auth
workspaces
bank-accounts
invoices
transactions
imports
matching
allocations
audit
dashboard
```

Keep module boundaries understandable.

Avoid unnecessary abstraction.

## Suggested Database Entities

```text
users
workspaces
sessions
bank_accounts
invoices
bank_transactions
import_batches
import_errors
match_suggestions
payment_allocations
allocation_reversals
audit_events
```

Adjust the schema only when technically justified.

Enforce workspace ownership through appropriate foreign keys, composite constraints, and authorization checks.

Do not rely exclusively on frontend filtering for tenant isolation.

Document:

* Relational schema.
* Foreign keys.
* Unique constraints.
* Financial invariants.
* Transaction boundaries.
* Locking strategy.
* Reversal strategy.

Use PostgreSQL as the authoritative source of financial state.

---

# 11. UX DESIGN METHODOLOGY

## Primary Design Philosophy

Coincela must follow:

1. Progressive Disclosure.
2. Task-Focused Interaction Design.
3. Calm Minimalist Interface Design.

### Fundamental Principle

**Show users what they need to understand their current situation and complete their next action. Reveal additional information only when relevant.**

Do not hide information essential to financial correctness.

The interface should feel quiet, confident, and understandable.

Avoid conventional AI-generated SaaS dashboard aesthetics.

## User Attention

Every screen should make four things obvious:

1. Where am I?
2. What am I looking at?
3. What requires my attention?
4. What should I do next?

Use one visually dominant primary action per task context whenever practical.

Avoid competing calls to action.

Do not fill unused space with decorative components.

## Visual Hierarchy

Prioritize:

* Clear page titles.
* Short supporting explanations.
* One main task.
* Relevant financial information.
* Secondary actions with reduced emphasis.

Information hierarchy must be determined by user goals, not by the quantity of available backend data.

## Progressive Onboarding

Guide first-time users through:

```text
Import invoices
       ↓
Import bank transactions
       ↓
Review suggestions
       ↓
Confirm allocations
       ↓
View results
```

Display clear progress and next actions.

Do not show an empty dashboard full of meaningless metrics to new users.

Experienced users must retain direct access to existing workflows.

## Dashboard Philosophy

The dashboard should answer:

**What needs my attention?**

Prioritize:

1. Outstanding invoice balance.
2. Payments requiring review.
3. The next useful action.
4. Recent financial activity.

Do not create a dashboard containing many unrelated metric cards.

Additional metrics belong in focused views.

Use charts only when they support a meaningful decision.

## Reconciliation Interface

Use a focused master-detail pattern.

### Desktop

Left panel:

* Incoming payments.
* Review status.
* Amount.
* Payer.
* Selection state.

Right panel:

* Selected transaction.
* Suggested invoice.
* Outstanding balance.
* Payment amount.
* Match explanation.
* Warnings.
* Confirmation controls.

Only one selected payment should receive primary visual focus.

### Mobile

Use a sequential layout.

Allow users to:

1. Select a payment.
2. Review its details.
3. Inspect suggested invoices.
4. Confirm or reject.

Preserve context between steps.

## Critical Financial Information

Before confirming an allocation, display:

* Payment amount.
* Invoice amount.
* Outstanding balance.
* Customer.
* Payment reference.
* Suggested allocation.
* Relevant discrepancies.

Do not hide financial consequences behind collapsed panels.

Suggestions must never look like completed reconciliations.

---

# 12. VISUAL DESIGN SYSTEM

Use a refined, restrained visual identity.

## Colors

* Soft off-white backgrounds.
* Deep charcoal primary text.
* Muted emerald accent.
* Subtle gray borders.
* Reserved warning and error colors.

Use color purposefully.

Do not use many unrelated accent colors.

## Typography

Use Inter or Geist.

Prioritize:

* Readable body text.
* Clear headings.
* Consistent type scale.
* Appropriate line spacing.
* Strong financial number legibility.

Use tabular numerals where beneficial for amounts.

## Components

Prefer:

* Simple buttons.
* Clear form fields.
* Readable tables.
* Subtle status badges.
* Focused dialogs.
* Lightweight notifications.
* Meaningful empty states.

Avoid:

* Glassmorphism.
* Neon colors.
* Heavy gradients.
* Excessive shadows.
* Oversized financial cards.
* Decorative charts.
* Unnecessary icons.
* Large instructional paragraphs.
* Attention-grabbing animations.

Use subtle transitions only when they clarify interaction.

## Navigation

Primary authenticated navigation:

```text
Overview
Import
Review Payments
Invoices
Activity
```

Keep transaction browsing available contextually through Import and Review Payments rather than introducing unnecessary primary navigation.

Keep account and workspace settings separate from the main task flow.

## Writing and Error Messages

Use plain language.

Avoid technical terminology unless it is essential.

Bad:

```text
AMBIGUOUS_RECONCILIATION_ERROR
```

Better:

```text
We found two invoices that could match this payment.

Choose the correct invoice before continuing.
```

Every actionable error should explain:

1. What happened.
2. Why it matters, when known.
3. How the user can resolve it.

---

# 13. ACCESSIBILITY REQUIREMENTS

Target WCAG 2.2 AA.

Implement:

* Semantic HTML.
* Keyboard navigation.
* Visible keyboard focus.
* Accessible form labels.
* Sufficient contrast.
* Screen-reader announcements.
* Non-color status indicators.
* Responsive layouts.
* Accessible dialogs.
* Clear validation feedback.

Do not communicate errors exclusively through color.

Do not rely on animations for essential information.

Maintain usability on mobile and desktop.

Accessibility must be reviewed during each relevant milestone.

---

# 14. PUBLIC DEMONSTRATION EXPERIENCE

The final application must be understandable to a recruiter opening it for the first time.

Implement a simple public landing page.

Explain:

* What Coincela does.
* Who it helps.
* How payment reconciliation works.
* How to try the application.

Provide downloadable synthetic CSV examples.

Support a guided first-use experience.

A demo workspace is optional.

If implemented:

* Use synthetic financial information only.
* Isolate demonstration records.
* Never expose administrative credentials.
* Do not allow visitors to modify another user's records.
* Use the real reconciliation backend.
* Avoid unrestricted access to shared financial data.

Do not create a simulated frontend that bypasses financial correctness rules.

The final live demonstration must communicate with the actual API and PostgreSQL database.

---

# 15. DEVELOPMENT EXECUTION PROTOCOL

Development MUST proceed milestone by milestone.

Do not implement the entire application in one execution.

Do not begin a future milestone without explicit instruction.

The trigger for continuing is:

**Continue with the next milestone.**

## Before Every Milestone

1. Inspect the repository.
2. Read existing project instructions.
3. Review completed milestones.
4. Review known defects.
5. Identify the current milestone.
6. Implement only its requirements.

Read these files when they exist:

```text
AGENTS.md
PROJECT_SPEC.md
context.md
docs/DECISIONS.md
docs/STATUS.md
docs/ARCHITECTURE.md
docs/DESIGN.md
```

## During Every Milestone

1. Implement the required functionality.
2. Integrate backend and frontend changes where relevant.
3. Add unit tests.
4. Add API tests.
5. Add PostgreSQL integration tests where appropriate.
6. Add browser tests where appropriate.
7. Review financial correctness.
8. Review accessibility.
9. Review responsive behavior.
10. Remove unnecessary complexity.

## After Every Milestone

Run applicable:

* Unit tests.
* API tests.
* Integration tests.
* TypeScript checks.
* Linting.
* Production builds.
* Browser tests.

Update project documentation.

Report results.

Stop.

Do not claim completion when mandatory tests have failed or were not executed.

If infrastructure is unavailable, report the blocker.

Do not fabricate verification results.

---

# 16. PROJECT DOCUMENTATION

Maintain the following files:

```text
AGENTS.md
PROJECT_SPEC.md
context.md
docs/STATUS.md
docs/DECISIONS.md
docs/ARCHITECTURE.md
docs/DESIGN.md
docs/DEPLOYMENT.md
```

## Responsibilities

### AGENTS.md

Persistent coding and development rules for Codex.

### PROJECT_SPEC.md

Accepted requirements, MVP scope, and acceptance criteria.

### context.md

Current implementation state and important technical context.

### docs/STATUS.md

Milestone progress, tests, blockers, and next steps.

### docs/DECISIONS.md

Important architectural and implementation decisions.

### docs/ARCHITECTURE.md

System structure, data model, and transaction design.

### docs/DESIGN.md

UX philosophy, visual system, navigation, and interaction patterns.

### docs/DEPLOYMENT.md

GitHub Pages, Render, Neon, and production configuration.

Keep these documents concise, accurate, and useful.

---

# MILESTONE 0 — FOUNDATION, DESIGN SYSTEM, AND DEPLOYMENT PREPARATION

## Objective

Establish a runnable full-stack foundation with coherent visual design and GitHub Pages compatibility.

## Backend

Create:

* Express TypeScript application.
* Health endpoint.
* Error handling middleware.
* Environment validation.
* PostgreSQL connection module.
* Database migration configuration.

## Frontend

Create:

* React TypeScript Vite application.
* Tailwind CSS.
* HashRouter.
* Main application layout.
* Reusable typography and spacing styles.
* Navigation foundation.
* Placeholder Overview page.
* API connectivity indicator.

Do not create an unnecessarily complex dashboard.

Implement a calm initial application shell.

## Design System

Establish:

* Color tokens.
* Typography scale.
* Spacing system.
* Button styles.
* Form field styles.
* Basic layout components.
* Accessible focus states.
* Responsive breakpoints.

Document design decisions.

## Deployment Foundation

Configure:

* Vite GitHub Pages base path.
* HashRouter.
* Frontend API environment variable.
* GitHub Actions CI.
* GitHub Pages deployment workflow.
* Production frontend build.
* Environment example files.

The frontend should be deployable independently.

Do not require Render or Neon credentials at this milestone.

## Infrastructure

Set up:

* npm workspaces.
* Docker Compose PostgreSQL.
* Vitest.
* Supertest.
* Playwright infrastructure.
* TypeScript checks.
* Linting.
* Database migration commands.

## Tests

Verify:

* Health endpoint.
* Error handling.
* Environment validation.
* Database connectivity.
* Frontend rendering.
* Production frontend build.
* Router functionality.
* Static asset path correctness.

## Completion Criteria

The frontend and backend run locally.

The frontend production build succeeds.

GitHub Pages deployment configuration exists and is validated as far as repository access permits.

All required tests pass.

Update documentation.

STOP.

---

# MILESTONE 1 — AUTHENTICATION AND FINANCIAL DATA FOUNDATION

## Objective

Implement secure user authentication and establish the relational financial model.

## Backend

Implement:

* Registration.
* Login.
* Logout.
* Secure password hashing.
* Short-lived opaque sessions.
* Protected endpoints.
* One workspace per user.
* Workspace ownership enforcement.

Create schema migrations for required financial entities.

Implement monetary parsing utilities.

## Frontend

Build:

* Registration screen.
* Login screen.
* Authenticated application layout.
* Logout action.
* Basic workspace settings.

Follow the established calm design system.

Do not overwhelm users with unnecessary account configuration.

## Deployment Compatibility

Implement:

* Strict CORS allowlisting.
* Authorization-header authentication.
* Production-origin configuration.
* Session expiration handling.

Ensure authentication does not depend on third-party cookies.

## Tests

Verify:

* Registration.
* Successful login.
* Invalid login.
* Duplicate email rejection.
* Session expiration.
* Session revocation.
* Protected endpoints.
* Workspace isolation.
* Invalid CORS origins.
* Monetary parsing.
* Database constraints.
* Database migrations.

## Completion Criteria

A user can register, log in, and access an isolated business workspace.

Authentication is compatible with the intended hosting architecture.

All required tests pass.

STOP.

---

# MILESTONE 2 — CSV IMPORT WORKFLOW

## Objective

Allow users to import invoices and incoming bank transactions safely.

## Backend

Implement:

* Invoice CSV parsing.
* Bank transaction CSV parsing.
* Field validation.
* Financial normalization.
* Date normalization.
* Import batches.
* Duplicate detection.
* Row-level errors.
* Import history.
* Invoice listing.
* Transaction listing.

Respect the defined import atomicity policy.

## Frontend

Build the Import Center.

The user should immediately understand what to do.

Provide:

* Import invoices.
* Import payments.
* Sample CSV download.
* File upload.
* Import validation results.
* Import summary.
* Clear next-step guidance.

After invoice import, guide users toward importing transactions.

After transaction import, guide users toward reviewing matches.

## Tests

Verify:

* Valid CSV files.
* Missing fields.
* Invalid amounts.
* Invalid dates.
* Unsupported currencies.
* Duplicate invoice imports.
* Duplicate external transaction IDs.
* Identical file reimport.
* Legitimate identical-looking bank transactions.
* Oversized uploads.
* Malformed CSV.
* Import atomicity.
* Unauthorized imports.

## UX Validation

Verify:

* First-time users can identify the primary action.
* Import errors are understandable.
* The next step is obvious.
* The interface works on mobile.
* Keyboard users can complete imports.

## Completion Criteria

Users can import realistic CSV records successfully.

Duplicate handling is explicit and safe.

The import workflow is understandable without technical documentation.

STOP.

---

# MILESTONE 3 — EXPLAINABLE MATCHING ENGINE

## Objective

Generate safe, deterministic reconciliation suggestions.

## Backend

Implement:

* Invoice reference matching.
* Amount comparison.
* Customer/payer evidence.
* Candidate ranking.
* Ambiguity detection.
* Unmatched payment handling.
* Match explanation generation.
* Stale suggestion handling.

Suggestion generation must not modify balances.

## Frontend

Build the Review Payments workspace.

Use the master-detail interaction pattern.

Display:

* Incoming payment list.
* Selected payment details.
* Suggested invoices.
* Supporting evidence.
* Warnings.
* Ambiguity indicators.

Make one selected transaction the visual focus.

Do not display excessive information simultaneously.

## Tests

Verify:

* Exact reference matches.
* Missing references.
* Incorrect references.
* Identical invoice amounts.
* Multiple possible invoices.
* Different customers with identical amounts.
* Partial-payment candidates.
* Closed invoices.
* Unmatched payments.
* Stale suggestions.

Create a verified matching fixture.

## UX Validation

Verify:

* Users can understand why a match was suggested.
* Ambiguous matches are unmistakably marked.
* Suggested matches do not appear confirmed.
* The interface remains focused.
* Mobile review is usable.

## Completion Criteria

Users can inspect meaningful payment suggestions.

No financial allocations occur during matching.

All required tests pass.

STOP.

---

# MILESTONE 4 — TRANSACTIONAL PAYMENT ALLOCATION

## Objective

Implement Coincela's core financial correctness functionality.

This is the most important engineering milestone.

## Backend

Implement:

* Manual payment allocation.
* Suggested match confirmation.
* Full payments.
* Partial payments.
* Multiple payments per invoice.
* One payment split across multiple invoices.
* Atomic multi-invoice allocation.
* Idempotent requests.
* Audit event creation.
* Row-level locking.
* Balance validation.

Apply the documented locking order.

Recalculate financial balances while holding required locks.

## Frontend

Implement:

* Payment confirmation.
* Allocation amount input.
* Split allocation.
* Remaining balance preview.
* Financial warnings.
* Success feedback.
* Clear validation errors.

Before confirmation, show the financial consequences.

Do not hide important numbers for visual minimalism.

## PostgreSQL Integration Tests

Required cases:

1. Full payment.
2. Partial payment.
3. Multiple payments against one invoice.
4. One payment split between invoices.
5. Exact remaining balance.
6. Over-allocation rejection.
7. Negative allocation rejection.
8. Zero allocation rejection.
9. Repeated identical request.
10. Conflicting idempotency request.
11. Concurrent allocation against one invoice.
12. Concurrent allocation against one bank transaction.
13. Concurrent overlapping split allocations.
14. Forced transaction failure.
15. Rollback correctness.
16. Cross-workspace allocation rejection.

Concurrency tests must use distinct PostgreSQL connections and genuinely overlapping transactions.

Do not simulate concurrency with sequential requests.

Verify final database state.

## Completion Criteria

No tested operation produces:

* Double allocation.
* Negative balances.
* Excess allocation.
* Partial commits.
* Cross-workspace financial mutations.

All financial operations remain transactionally correct under the tested scenarios.

STOP.

---

# MILESTONE 5 — REVERSALS AND AUDIT HISTORY

## Objective

Make reconciliation decisions reversible and traceable.

## Backend

Implement:

* Allocation reversals.
* Required reversal reasons.
* Duplicate reversal prevention.
* Atomic reversal transactions.
* Audit records.
* Reversal history.
* Concurrent reversal safety.

Preserve original allocations.

## Frontend

Build the Activity section.

Include:

* Reconciliation history.
* Allocation details.
* Audit timeline.
* Reversal action.
* Reversal confirmation.
* Reversal reason input.

Make corrections discoverable without giving them unnecessary visual prominence.

## Tests

Verify:

* Successful reversal.
* Duplicate reversal rejection.
* Concurrent reversal requests.
* Balance restoration.
* Reallocation after reversal.
* Audit record persistence.
* Unauthorized reversal rejection.
* Reversal rollback.
* Preservation of original allocation records.

## Completion Criteria

Users can safely correct reconciliation mistakes.

Audit history remains intact.

All required tests pass.

STOP.

---

# MILESTONE 6 — COMPLETE USER EXPERIENCE

## Objective

Deliver a cohesive application that ordinary users can operate confidently.

## Frontend

Complete:

* Public landing page.
* Registration and login.
* Overview.
* Import Center.
* Review Payments.
* Invoices.
* Activity.
* Invoice details.
* Transaction details.
* Reconciliation confirmation.
* Reversal workflow.

## Progressive Onboarding

New users should see a clear first action.

Guide users through:

1. Import invoices.
2. Import transactions.
3. Review suggestions.
4. Confirm allocations.
5. Review balances.

Avoid overwhelming beginners with advanced financial details prematurely.

## Overview

Display:

* Outstanding invoice balance.
* Payments requiring review.
* Primary next action.
* Compact recent activity.

Secondary financial statistics may be accessed through focused views.

Do not create a dashboard of unnecessary charts.

## Public Demonstration

Add:

* Clear landing page.
* Explanation of the product.
* Sample datasets.
* Guided first-use experience.
* Helpful empty states.
* Responsive layouts.
* Backend-unavailable feedback.

## Playwright Tests

Cover:

* Registration.
* Login.
* Invoice import.
* Transaction import.
* Matching suggestions.
* Partial allocation.
* Split allocation.
* Reversal.
* Updated outstanding balances.
* Session expiration.
* Error recovery.

## UX Review

Evaluate every screen:

* Is the purpose immediately understandable?
* Is the primary action clear?
* Is information visually prioritized?
* Are financial details sufficiently visible?
* Can users recover from mistakes?
* Is the experience accessible?
* Does it work on smaller screens?

Simplify unnecessary complexity.

## Completion Criteria

A first-time user can complete the reconciliation workflow without needing technical documentation.

The interface is calm, cohesive, responsive, and accessible.

STOP.

---

# MILESTONE 7 — RELIABILITY, BENCHMARKS, AND PRODUCTION DEPLOYMENT

## Objective

Complete verification, documentation, and public deployment.

## Testing

Run the full suite:

* Unit tests.
* API tests.
* PostgreSQL integration tests.
* Concurrency tests.
* Playwright tests.
* TypeScript checks.
* Linting.
* Production builds.

Resolve failures.

Do not hide failing or skipped tests.

## Benchmarking

Create deterministic synthetic datasets containing:

* Valid payments.
* Exact reference matches.
* Missing references.
* Ambiguous matches.
* Incorrect references.
* Partial payments.
* Split payments.
* Duplicate records.
* Unmatched transactions.

Keep ground-truth relationships independent of the matching implementation.

Benchmark datasets such as:

* 100 invoices and 100 transactions.
* 1,000 invoices and 1,000 transactions.
* 10,000 invoices and 10,000 transactions.

Measure:

* Import duration.
* Matching duration.
* Matching precision.
* Matching recall.
* Ambiguous-case detection.
* Duplicate processing behavior.
* Financial correctness under concurrency.

Record actual results.

Do not invent performance improvements or accuracy claims.

## Security Review

Verify:

* Authentication.
* Authorization.
* Workspace isolation.
* SQL injection prevention.
* CSV upload limits.
* Malicious CSV handling.
* Sensitive data logging.
* Environment configuration.
* Session expiration.
* CORS policy.
* Secret exposure prevention.

## Production Deployment

Prepare and execute, where credentials and provider access permit:

1. Neon PostgreSQL configuration.
2. Production database migrations.
3. Render backend deployment.
4. Backend health verification.
5. Production CORS configuration.
6. GitHub Pages frontend deployment.
7. Production API URL configuration.
8. Browser-based production smoke tests.
9. Authentication verification.
10. CSV import verification.
11. Matching verification.
12. Allocation verification.
13. Reversal verification.
14. Audit history verification.
15. Route refresh verification.
16. Secrets and configuration review.

Verify the actual public application.

If hosting access is unavailable, prepare the deployment configuration and document the remaining steps.

Do not claim that deployment succeeded without verifying the public URLs.

## Documentation

Finalize:

```text
README.md
docs/ARCHITECTURE.md
docs/DATABASE.md
docs/RECONCILIATION.md
docs/TESTING.md
docs/BENCHMARKS.md
docs/DESIGN.md
docs/DECISIONS.md
docs/DEPLOYMENT.md
```

## README Requirements

Prominently present:

* Coincela name and tagline.
* Live demo link.
* GitHub repository.
* Problem statement.
* Target users.
* Screenshots.
* Core workflow.
* Architecture diagram.
* Technology stack.
* Financial correctness design.
* Concurrency testing.
* Benchmark results.
* Local setup instructions.
* Deployment instructions.
* Known limitations.

The README must be understandable to both technical interviewers and nontechnical recruiters.

Use synthetic screenshots and sample data.

Never publish real customer financial information.

## Final Completion Criteria

Coincela is complete only when:

* The frontend is publicly accessible on GitHub Pages.
* The backend is accessible through HTTPS.
* PostgreSQL is hosted on Neon.
* Authentication works in production.
* The full reconciliation workflow works online.
* Financial operations use the actual transactional backend.
* Reversals preserve financial history.
* Relevant automated tests pass.
* CI/CD works.
* Production configuration is secure.
* Documentation is accurate.
* The README contains a verified live demo link.

If a deployment prerequisite is missing, report the project as implementation-complete but deployment-blocked, not fully complete.

STOP.

---

# 17. REQUIRED MILESTONE REPORTING FORMAT

After every milestone, provide:

## Milestone Completed

Milestone number and name.

## Implemented

Brief summary of functional changes.

## Important Files

Main files created or modified.

## Tests

Include:

* Commands executed.
* Passing tests.
* Failing tests.
* Skipped tests.
* Environment limitations.

## Engineering Decisions

Important technical or architectural choices.

## UX Decisions

Important interaction and visual design decisions.

## Known Issues

Remaining defects or limitations.

## Next Milestone

Next milestone and its purpose.

Do not begin the next milestone automatically.

---

# 18. NONNEGOTIABLE RULES

Never:

* Fabricate test results.
* Ignore failing financial tests.
* Use floating-point arithmetic for money.
* Trust client-calculated balances.
* Silently reconcile ambiguous payments.
* Delete historical allocations.
* Remove audit records to hide mistakes.
* Ignore transaction failures.
* Permit cross-workspace allocations.
* Treat visual suggestions as confirmed payments.
* Expose credentials in frontend builds.
* Hardcode production secrets.
* Create fake production functionality.
* Claim deployment success without verification.
* Introduce unnecessary infrastructure.
* Add unnecessary visual components.
* Implement future milestones prematurely.
* Change unrelated working code without justification.

Always:

* Prefer explicit, maintainable code.
* Use meaningful automated tests.
* Preserve financial invariants.
* Communicate errors clearly.
* Keep the interface focused.
* Maintain responsive and accessible UX.
* Document architectural decisions.
* Report verification results accurately.

---

# 19. FINAL DEVELOPMENT DIRECTIVE

Develop Coincela progressively.

Prioritize:

**Financial correctness, clear user interactions, simple architecture, meaningful testing, and working public deployment.**

Each milestone must produce a functional, verifiable result.

UX design is part of every milestone, not a final polishing activity.

Production compatibility is part of the architecture from the beginning.

Do not treat GitHub Pages deployment as an unrelated afterthought.

Do not turn Coincela into a generic accounting platform.

The finished application should demonstrate thoughtful engineering by solving a real workflow correctly and presenting it in a way ordinary users can understand.

## START NOW

Begin with **Milestone 0 only**.

First inspect the repository, tools, and development environment.

Preserve compatible existing code.

Establish the project foundation, create the design system, configure the testing infrastructure, prepare GitHub Pages deployment, run the required checks, update documentation, and report your results.

Do not proceed to Milestone 1 until explicitly instructed.
