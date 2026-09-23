# House Account Architecture Audit

The target product is **ระบบบริหารจัดการข้อมูลพื้นฐานของหมู่บ้าน** / **Village Basic Information Management System**.

The architecture audit found that the existing runtime treats `User` as both an authentication principal and an individual Resident. Phase 2 introduces an additive data-model foundation while preserving phone OTP, `BindingRequest`, `Person.userId`, and every existing route. Existing Resident users are not converted or merged in this phase.

## Phase 2 schema contract

```text
User (Better Auth principal)
  ├── HEADMAN
  ├── LEGACY_RESIDENT (temporary)
  └── RESIDENT_HOUSE
          │
          └── ResidentHouseAccount
                  │
                  └── House (houseId is globally unique)

User / ResidentHouseAccount
          │
          └── AccountEmail[]

House
  └── HouseAccountOpeningRequest[]
```

### Invariants

1. `User` remains the Better Auth principal.
2. `User.accountKind` is nullable during staged classification.
3. `ResidentHouseAccount.userId` is unique: a House Account has exactly one User principal.
4. `ResidentHouseAccount.houseId` is unique: a House has at most one Resident House Account.
5. `VillageMembership` remains the authorization model; `ResidentHouseAccount` does not replace it.
6. A Resident House Account and its House must belong to the same Village. Prisma cannot express this cross-table check, so mutations must call the persisted-House validation helper in their transaction.
7. `AccountEmail.normalizedEmail` is the single global login-email namespace for pending requests, House Accounts, Headmen, and recovery identities.
8. Email normalization trims and lowercases only. Dots and plus tags are preserved.
9. `contactPhone` is contact information. It is not unique, login-capable, or OTP-verified.
10. Opening requests reference existing Houses and retain immutable email snapshots.
11. Only one request in `PENDING_EMAIL_VERIFICATION` or `PENDING_REVIEW` may exist for a House at a time; a migration-level partial unique index enforces this.
12. `User.email` remains a Better Auth compatibility field and is not synchronized with `AccountEmail` in Phase 2.

### Email release contract

An opening request in `REJECTED`, `CANCELLED`, or `EXPIRED` may release its address without deleting history:

1. retain `emailSnapshot` and `normalizedEmailSnapshot` on the historical request;
2. mark the single `AccountEmail` identity `REVOKED`;
3. clear account ownership and move its nullable `openingRequestId` only in a controlled transaction;
4. reclaim that same globally unique identity row for a future request.

No second pending-email table or uniqueness namespace is permitted.

### Migration boundary

The Phase 2 migration adds enums, models, relations, indexes, and a nullable `User.accountKind`. It backfills active Headmen as `HEADMAN` and other Users with a Resident membership as `LEGACY_RESIDENT`. Unsupported or unclassified Users remain null.

It does not create `ResidentHouseAccount` rows, create `AccountEmail` rows, alter ownership records, apply Email OTP, or remove any legacy authentication/binding data.

## Phase 3 — Email OTP foundation

Phase 3 adds an independent Email OTP domain beside the existing phone OTP implementation. It does not add a public Email OTP route, change `/auth/login`, `/auth/register`, or `/auth/verify-otp`, create a User, activate an opening request, or alter the current Binding flow.

### Provider and challenge lifecycle

`EmailProvider` is the provider-neutral contract. `ConsoleEmailProvider` is available only when `NODE_ENV !== "production"`; it masks the recipient and is rejected in production. `SmtpEmailProvider` uses generic SMTP through Nodemailer and sends centralized Thai plain-text and HTML templates. Automated tests use `InMemoryEmailProvider` and perform no network delivery.

```text
PENDING_DELIVERY
  ├── ACTIVE
  ├── DELIVERY_FAILED
  └── CANCELLED

ACTIVE
  ├── PENDING_DELIVERY (bounded resend with a rotated code)
  ├── VERIFIED
  ├── LOCKED
  ├── EXPIRED
  └── CANCELLED

VERIFIED
  ├── CONSUMED
  ├── EXPIRED
  └── CANCELLED
```

The OTP is six numeric digits from `crypto.randomInt`. Only a random-salt scrypt derivation is persisted; the derivation also binds the code to the normalized email, purpose, and `EMAIL_OTP_HASH_SECRET`. Raw IP addresses and user agents are not persisted: keyed HMAC values are used for abuse controls.

The defaults are a 300-second lifetime, five failed verification attempts, a 60-second resend cooldown, five resends, a 900-second rate window, five new challenges per normalized email, and twenty new challenges per available client-IP hash. A PostgreSQL advisory lock serializes issuance for an email/purpose, and a partial unique index is the final guard against more than one live challenge. Successful verification moves `ACTIVE` to `VERIFIED`; a later business transaction must move it once to `CONSUMED`. The consume service accepts an optional transaction callback so the one-time transition and the future purpose-specific business mutation can commit atomically. Delivery failure moves `PENDING_DELIVERY` to `DELIVERY_FAILED`, so it cannot be verified.

No unrestricted `POST /api/auth/email-otp` route exists. Future public entry points must be purpose-specific wrappers that validate House-opening, active-alias, or Headman eligibility before calling the central service. A future login wrapper must return a generic response regardless of alias existence; explicit “already reserved” feedback is limited to the opening-request domain.

### AccountEmail reservation lifecycle

`reserveEmailForOpeningRequest` normalizes through the single `normalizeAccountEmail()` helper, takes a transaction-scoped advisory lock, and relies on the global `AccountEmail.normalizedEmail` unique constraint as its concurrency backstop. An owned, active, or live-reserved row conflicts. An unowned `REVOKED` row may be reclaimed only when its previous request is `REJECTED`, `CANCELLED`, or `EXPIRED`. Reclaim moves the identity row to the new request but never changes the old request's email snapshots.

Allowed identity states remain centralized:

```text
PENDING_VERIFICATION → VERIFIED_PENDING_REVIEW → ACTIVE → REVOKED
          └───────────────────────────────→ REVOKED
REVOKED → PENDING_VERIFICATION (controlled reclaim only)
```

The service can mark a reserved address verified, attach an already-created User/ResidentHouseAccount during a later activation transaction, revoke an address, and release a terminal opening request. It does not create Users, ResidentHouseAccounts, or opening requests. Revocation refuses to remove an account's final active login address.

### Production configuration

Production requires `EMAIL_PROVIDER=smtp`, a valid host/port/from configuration, paired SMTP user/password when authentication is used, and an explicit `EMAIL_OTP_HASH_SECRET` of at least 32 characters. There is no production fallback to the console provider or `BETTER_AUTH_SECRET`. Local development may use `EMAIL_PROVIDER=console`; only that provider prints an OTP, and only outside production.

### Better Auth 1.5.5 finding

The installed Better Auth Email OTP sign-in route lowercases the submitted address and calls `internalAdapter.findUserByEmail(email)`. It therefore resolves `User.email`, not `AccountEmail.normalizedEmail`, and cannot implement many aliases mapping to one House Account User.

Better Auth publicly exports the plugin endpoint builder `createAuthEndpoint`. Its bundled Email OTP route creates sessions through `ctx.context.internalAdapter.createSession(...)` and writes cookies with an internal `setSessionCookie(...)` import. Those session details are not an appropriate stable application integration contract. Phase 3 consequently does not add a session bridge or monkey-patch Better Auth. Before House Account login is implemented, the project must confirm an officially supported custom-plugin method for creating a session for a User already resolved from `AccountEmail`; otherwise the auth boundary needs a documented adapter strategy.

`User.email` remains a non-authoritative Better Auth compatibility value. The recommended direction is to retain one stable canonical verified address only if Better Auth's supported session integration requires it. Do not synchronize it to whichever alias was most recently added or used, and do not introduce synthetic addresses until that requirement is proven. Login authorization must resolve an active `AccountEmail` to its owning User/ResidentHouseAccount first.

## Phase 4 — Public House Account opening request

`/auth/register` is now the sole public House Account opening surface. The visible personal-registration form has been replaced, while the legacy phone-registration APIs remain temporarily available for migration safety. The new form collects an existing House, applicant first and last name, contact phone, login email, and privacy consent. It does not collect National ID, date of birth, gender, password, Person identity, or SMS verification.

House lookup is limited to the configured Village, returns at most six `houseId`/`houseNumber` pairs, and never returns population, contact, or account data. A one-character query performs exact matching; longer input performs prefix matching. A keyed-IP, process-local fixed-window limiter adds a best-effort public-search control. A shared distributed limiter remains advisable before horizontally scaled production deployment. No House is created from public input, and no occupancy restriction is applied because the current repository contains no existing Resident-account eligibility policy tied to `House.occupancyStatus`.

The creation transaction takes a House-scoped advisory lock, re-reads the selected House in the configured Village, checks `ResidentHouseAccount`, checks the two live opening-request statuses, creates `HouseAccountOpeningRequest(PENDING_EMAIL_VERIFICATION)`, and reserves its `AccountEmail` through the Phase 3 domain service. The transaction-aware reservation primitive prevents an email conflict from leaving an orphan live request. Existing database uniqueness constraints remain the final House/email concurrency guards.

After commit, the service issues only a `HOUSE_OPENING` challenge. Delivery failure performs a compensating cancellation and releases the email reservation. Resend and verification require the challenge to match the signed request, purpose, AccountEmail, and normalized email. Successful verification atomically performs:

```text
AccountEmail: PENDING_VERIFICATION → VERIFIED_PENDING_REVIEW
HouseAccountOpeningRequest: PENDING_EMAIL_VERIFICATION → PENDING_REVIEW
requestedAt: null → now
EmailOtpChallenge: VERIFIED → CONSUMED
```

The same transaction creates notifications for active Headmen and a public audit entry with `userId = null`. Neither contains email, phone, OTP data, hashes, or salts. Notification metadata intentionally has no action URL until the Phase 5 review route exists.

Applicant access is authorized by a 30-minute signed HTTP-only, SameSite=Lax cookie scoped to the House-opening API. Production requires an explicit `HOUSE_ACCOUNT_OPENING_ACCESS_SECRET` of at least 32 characters; development may fall back to `BETTER_AUTH_SECRET`. Raw request IDs, email addresses, and phone numbers are not used as URL authorization. The cookie permits status recovery, resend, verification, and cancellation. Cancellation is allowed for `PENDING_EMAIL_VERIFICATION` and `PENDING_REVIEW`, cancels live challenges, transitions the request to `CANCELLED`, and revokes/releases the AccountEmail without deleting history.

Phase 4 does not create a User, ResidentHouseAccount, VillageMembership, Person link, or BindingRequest, and it does not issue a session. Phone login, Headman phone login, legacy Binding, and old phone-registration API implementations remain present. Runtime database integration tests remain pending because the additive Phase 2 and Phase 3 migrations have not been applied.
