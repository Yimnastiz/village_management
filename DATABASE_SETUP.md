# Database Setup (PostgreSQL + Prisma)

For local development:

```powershell
npm install
npm run db:up
npm run setup
npm run setup:bootstrap
npm run dev
```

`npm run setup` creates local environment configuration when needed, confirms PostgreSQL is reachable, generates Prisma Client, and applies committed migrations. It intentionally does not create application data.

## Initial Village and Headman bootstrap

Before running `npm run setup:bootstrap`, provide these setup-only environment variables in the operator shell or local `.env` file:

```env
BOOTSTRAP_VILLAGE_NAME="<village name>"
BOOTSTRAP_VILLAGE_SLUG="<safe-village-slug>"
BOOTSTRAP_VILLAGE_MOO="<moo>"
BOOTSTRAP_VILLAGE_PROVINCE="<province>"
BOOTSTRAP_VILLAGE_DISTRICT="<district>"
BOOTSTRAP_VILLAGE_SUBDISTRICT="<subdistrict>"
BOOTSTRAP_HEADMAN_PHONE="<thai-10-digit-phone>"
BOOTSTRAP_HEADMAN_NAME="<headman name>"
```

The CLI-only bootstrap creates a Village only when no active Village exists. With one active Village, it reuses that Village; with multiple active Villages, it stops without selecting, changing, or deleting any Village.

The Headman is created or reused as a normal `User` and receives an ACTIVE `VillageMembership` with role `HEADMAN`. The script never creates a Super Admin or Assistant Headman, never demotes another active Headman, and never creates a web/API bootstrap route. The Headman uses the normal OTP login flow after provisioning.

`PhoneRoleSeed` is not used as production authority and is not created by this command. It remains a development helper only.

Bootstrap variables are needed only for initial provisioning; runtime Village resolution uses database records. Thailand Village catalog import is optional and is not required by bootstrap.

The runtime requires exactly one active Village row. Existing inactive and historical Village data is retained and must not be removed as part of normal setup. Do not use `npm run db:reset` against data that must be retained.
