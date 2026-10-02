# Village Management System

This deployment serves exactly one configured active Village. Public pages, registration, and authenticated workspaces resolve that Village on the server and show a controlled configuration error when zero or multiple active Village rows exist.

Active actors are Public / Guest, Resident, and Headman. Headman is the only active administrator and works in `/admin`; there is no Super Admin runtime.

## Local setup

```powershell
npm install
npm run db:up
npm run setup
npm run setup:bootstrap
npm run dev
```

`npm run setup` creates `.env` when needed, verifies database connectivity, generates Prisma Client, and deploys committed migrations. It does not create Village or user records and it does not import the Thailand Village catalog by default.

`npm run setup:bootstrap` is an operator-run CLI command that provisions only the configured Village and its initial Headman. It reads the complete installation identity from `config/installation-village.json` (official code `66080210`) and creates or updates only that one `ThailandVillageMaster` record as needed. Set the documented Headman `BOOTSTRAP_*` values first. It provides no web endpoint.

Before bootstrap, set `BOOTSTRAP_HEADMAN_NAME` and the required `BOOTSTRAP_HEADMAN_EMAIL` in `.env` (use `EMAIL_PROVIDER=console` locally). `BOOTSTRAP_HEADMAN_PHONE` is optional contact information only. The initial Headman is a normal `User` with an ACTIVE HEADMAN membership; after bootstrap, open `/auth/login`, enter the configured email, and complete the emailed verification code to reach `/admin`. Bootstrap reruns preserve an existing Headman's login email.

```ini
BOOTSTRAP_HEADMAN_NAME="Initial Headman"
BOOTSTRAP_HEADMAN_EMAIL="headman@example.com"
EMAIL_PROVIDER="console"
# Optional contact information; never used to authenticate.
BOOTSTRAP_HEADMAN_PHONE="0812345678"
```

`/auth/login` is shared by every account type. Residents use any active verified House Account email, while the Headman uses the configured User email. The server resolves the account and permissions; House number is household data and is not a login credential.

Catalog utilities are optional maintenance tooling and are not part of fresh installation:

```powershell
npm run catalog:setup
npm run catalog:status
```

Nationwide catalog data is not required for bootstrap, public navigation, or registration. Do not use `npm run db:reset` against data that must be retained.

See [DATABASE_SETUP.md](DATABASE_SETUP.md) for bootstrap variables and database notes.
