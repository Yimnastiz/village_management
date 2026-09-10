# Database Setup (PostgreSQL + Prisma)

For local development:

```powershell
npm install
npm run db:up
npm run setup
```

`npm run setup` creates local environment configuration when needed, applies existing Prisma migrations, generates the client, and seeds configured data. It does not import the Thailand Village catalog by default; use `npm run catalog:setup` only for optional catalog maintenance.

The active administrative workspace is the authenticated Headman `/admin` area.

The runtime requires exactly one active Village row. Existing inactive and historical Village data is retained and must not be removed as part of normal setup.
