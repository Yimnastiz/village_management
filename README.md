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

The initial Headman is a normal user with an ACTIVE HEADMAN membership and signs in through the normal OTP flow.

Catalog utilities are optional maintenance tooling and are not part of fresh installation:

```powershell
npm run catalog:setup
npm run catalog:status
```

Nationwide catalog data is not required for bootstrap, public navigation, or registration. Do not use `npm run db:reset` against data that must be retained.

See [DATABASE_SETUP.md](DATABASE_SETUP.md) for bootstrap variables and database notes.
