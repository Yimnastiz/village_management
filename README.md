# Village Management System

This deployment serves exactly one configured active Village. Public pages, registration, and authenticated workspaces resolve that Village on the server. The application shows a controlled configuration error when zero or multiple active Village rows exist.

Active actors are Public / Guest, Resident, and Headman. Headman is the only active administrator and works in `/admin`.

## Local setup

```powershell
npm install
npm run db:up
npm run setup
npm run dev
```

`npm run setup` creates `.env` when needed, generates Prisma Client, deploys migrations, and runs the configured seed. It does not import the Thailand Village catalog by default.

Catalog utilities are optional maintenance tooling:

```powershell
npm run catalog:setup
npm run catalog:status
```

Catalog data is not required for public navigation or registration. Do not use `npm run db:reset` against data that must be retained.

See [DATABASE_SETUP.md](DATABASE_SETUP.md) for database notes and `docs/` for the active permission model.
