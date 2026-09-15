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
BOOTSTRAP_HEADMAN_PHONE="<thai-10-digit-phone>"
BOOTSTRAP_HEADMAN_NAME="<headman name>"
```

The target catalog identity is committed in `config/installation-village.json`; this installation uses official code `66080204` (บ้านเขาทราย หมู่ 4, ตำบลเขาทราย อำเภอทับคล้อ จังหวัดพิจิตร). Import the catalog before bootstrap. The CLI derives the Village name, route, moo, and location from that catalog row, rather than accepting manually entered geographic fields.

The CLI-only bootstrap creates a Village only when no active Village exists. With one active Village, it reuses it only when its `catalogVillageId` already matches the configured catalog record; a mismatch stops safely without selecting, changing, or deleting any Village.

The Headman is created or reused as a normal `User` and receives an ACTIVE `VillageMembership` with role `HEADMAN`. The script never creates a Super Admin or Assistant Headman, never demotes another active Headman, and never creates a web/API bootstrap route. The Headman uses the normal OTP login flow after provisioning.

`PhoneRoleSeed` is not used as production authority and is not created by this command. It remains a development helper only.

Bootstrap variables are needed only for initial provisioning; runtime Village resolution uses database records. The Thailand Village catalog is required before bootstrap.

The runtime requires exactly one active Village row. Existing inactive and historical Village data is retained and must not be removed as part of normal setup. Do not use `npm run db:reset` against data that must be retained.

## Correcting a pre-existing installation

Do not relabel or attach records from another moo to the configured catalog Village. If an installation is currently active as `66080210` / หมู่ 10, retain that Village and all of its related operational records as historical data. After reviewing the records, provision a new active Village from catalog record `66080204` with `catalogVillageId` set to that catalog row's id and identity fields derived from the row (`เขาทราย-4-66080204`, หมู่ `4`, เขาทราย, ทับคล้อ, พิจิตร). Archive the old Moo 10 Village by setting only its `isActive` value to false in the same controlled change, so exactly one Village remains active. Do not copy Moo 10 members, houses, residents, places, or news into Moo 4; migrate only records independently verified as belonging to Moo 4.
