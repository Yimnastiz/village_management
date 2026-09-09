# Database Setup (PostgreSQL + Prisma)

For local development:

```powershell
npm install
npm run db:up
npm run setup
```

`npm run setup` creates local environment configuration when needed, applies existing Prisma migrations, generates the client, seeds configured data, and loads the Thailand Village catalog when available. It does not create or configure a Super Admin account.

The active administrative workspace is the authenticated Headman `/admin` area. Do not use legacy `/superadmin` routes.
