# Database Setup (PostgreSQL + Prisma)

For local development:

```powershell
npm install
npm run db:up
npm run setup
npm run setup:bootstrap
npm run dev
```

Before `npm run setup:bootstrap`, provide `BOOTSTRAP_HEADMAN_NAME` and the required `BOOTSTRAP_HEADMAN_EMAIL` in `.env` or the operator shell. Set `EMAIL_PROVIDER=console` for local development. The email is normalized and becomes the Headman's login email. `BOOTSTRAP_HEADMAN_PHONE` is optional contact information only, never a login credential.

```ini
BOOTSTRAP_HEADMAN_NAME="Initial Headman"
BOOTSTRAP_HEADMAN_EMAIL="headman@example.com"
EMAIL_PROVIDER="console"
# Optional contact information; never used to authenticate.
BOOTSTRAP_HEADMAN_PHONE="0812345678"
```

The complete installation Village is committed in `config/installation-village.json`: official code `66080210`, เขาทราย หมู่ 10, ตำบลเขาทราย อำเภอทับคล้อ จังหวัดพิจิตร. Bootstrap reads these values directly and creates or updates only the matching `ThailandVillageMaster` row when needed. Importing the nationwide catalog is not required.

Bootstrap creates the configured Village when no active Village exists, then creates or reuses the Headman as a normal `User` with an ACTIVE `VillageMembership` and role `HEADMAN`. It never creates a Super Admin, Assistant Headman, Resident account, or phone-login credential. Bootstrap reruns preserve the existing Headman's login email.

Authentication uses one UI and one server-owned resolution flow: Residents enter any active verified `AccountEmail`; the Headman enters the configured `User.email`; both then enter the verification code sent by email. House number and phone number are not authentication credentials, and the browser does not choose an account type.

Existing inactive and historical Village data is retained. Do not use `npm run db:reset` against data that must be retained. Nationwide catalog utilities remain optional maintenance tooling.
