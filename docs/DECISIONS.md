# Engineering decisions

2026-10-24, Milestone 0:

- Use two npm workspaces and explicit modules without prematurely building domain abstractions.
- Pin the Node baseline to the installed 22.14.0; use Vite 8, Tailwind 4, Vitest 5, Zod 4, csv-parse 7 and node-pg-migrate 9 compatible with that runtime. Audit during setup exposed advisories in older major versions, prompting these updates. Align Vite at the workspace root to share plugin types with Vitest. Lock exact resolved dependencies in package-lock.json. Inter ships locally.
- Use `/Coincela/` base and HashRouter so deep routes survive GitHub Pages refresh. Follow [Vite's official deployment guide](https://vite.dev/guide/static-deploy) and [Tailwind's Vite plugin setup](https://tailwindcss.com/docs/installation/using-vite).
- Separate process liveness from real PostgreSQL readiness. A missing database does not falsely mark the API process dead. Error responses omit internal messages and credentials.
- Do not create domain migrations until Milestone 1. Migration tooling can initialize its own history metadata; an empty domain migration set is intentional.
- Keep production frontend independently buildable without backend credentials. Missing or invalid public API configuration produces an honest unconfigured indicator. Test builds use a dedicated local API configuration; deployment rebuilds with a repository variable.
- Use an isolated native PostgreSQL cluster for local verification because Docker is absent; retain Compose for normal local setup and service-backed CI. No existing database is modified.
- Current shell has no authentication or money handling. Future opaque bearer sessions use memory/sessionStorage (not localStorage), with XSS exposure mitigated by safe React output, no unsafe HTML, dependency hygiene, and short expiry. This is a planned requirement, not implemented functionality.
