# Documentation Source of Truth

> Read this file before generating system diagrams or describing actors, permissions, registration, Binding, or Super Admin behavior. Historical migrations and obsolete routes must not be used to infer removed features. Active schema/code plus this document define the current scope.

## Active actors and scope

The only active actors are: **Public / Guest**, **Resident**, **Headman**, **Assistant Headman**, and **Super Admin**.

Not active: Village Committee role; SOS/Emergency feature; post-resolution Issue rating/scoring; and HouseholdCorrectionRequest or any Resident population/household-correction-request workflow.

Public / Guest can access public village information. A Resident can access internal Resident features only when account and binding state permit under the current access-control rules.

## Registration and resident registry corrections

`Register → validate registration data → OTP verification → User account created/verified → Resident may submit house-binding request → Headman / Assistant Headman / authorized Super Admin support review Binding`

Headman and Assistant Headman do **not** approve user registration. There is no registration approval/rejection workflow for village administrators.

Residents cannot submit population or household correction requests in the system. For incorrect registry information, the Resident contacts the Headman or Assistant Headman; an authorized village administrator corrects House/Person data directly through population-management functions.

## Village administration

Both roles use the same `/admin` workspace; there is no separate Assistant application.

- **HEADMAN = Governance + Operations.**
- **ASSISTANT_HEADMAN = Operations.**

Both perform operational work: News, Gallery, Places, Contacts, Downloads, Transparency, Calendar, Issues, Appointments, Houses, People, Binding review, member operational status, and village Audit Log viewing.

Headman-only governance capabilities are population import, import rollback, sensitive/full population export, Assistant role management, and village settings. A Headman cannot manage another Headman; Headman assignment/management belongs to Super Admin. Exact server-authorized capability names are maintained in [ADMIN_PERMISSION_MATRIX.md](ADMIN_PERMISSION_MATRIX.md) and `src/lib/village-permissions.ts`.

### Sensitive action reason policy

Headman/Assistant do not need a generic reason for ordinary CRUD. A trimmed reason of at least five characters is required only where the centralized `src/lib/sensitive-action-policy.ts` policy requires it, including rejection, destructive removal/finalization, suspend/reactivate, cancellation, override or conflict handling, role change, import, rollback, and sensitive export. The policy, not UI visibility, is authoritative.

## Super Admin

Super Admin has two responsibilities: system-level administration and village-support operations on behalf of a Headman. Within `/superadmin/villages/[villageId]/...`, Super Admin can perform Headman-equivalent village operations under the finalized support workflow and may manage Headman accounts/assignment.

Every Super Admin **village mutation** requires a support reason of at least five trimmed characters, selected-village scope validation, and an Audit Log entry. Read-only operations do not require a support reason. See [../SUPERADMIN_ACCESS.md](../SUPERADMIN_ACCESS.md) for access/session setup.

## Binding identity reconciliation

Imported population data can already hold a `Person` with a National ID, House, and `userId = null`. When a registered User submits Binding, authorized reviewers use the shared same-village, exact National ID reconciliation rule:

- One unlinked matching Person is shown to the reviewer; the reviewer must explicitly confirm reuse.
- On confirmation, the existing Person is linked to the User; its Person ID and imported registry data are preserved. A duplicate Person is not created.
- No match uses normal Person creation/linking behavior.
- Multiple matching Persons block approval; no record is guessed or selected automatically.
- A Person linked to another User blocks unsafe relinking.
- A House mismatch is shown clearly and follows the existing override/reason policy; the Person is not silently moved.

This behavior is shared by all authorized Binding reviewers, while authorization remains role-specific. Existing bound-identity safeguards and duplicate-unbound-user cleanup remain part of approval.

## Audit and notifications

Audit Log is the accountability mechanism. Headman/Assistant may view village audit information according to permissions, and Super Admin support mutations are audited. Audit Log records are not user-editable or user-deletable. Do not infer that harmless reads are logged.

Notifications are workflow-specific: affected users receive meaningful outcomes (for example Binding approval/rejection and other policy-driven affected-user notifications). Avoid notification spam; Headman is not notified for every Assistant action. Use Audit Log, rather than routine notifications, for accountability.

## Active modules

News; Gallery; Places; Contacts; Downloads; Transparency; Calendar; Issues; Appointments; Population; Houses; People; Binding; Members/Admins; Notifications; Audit Log; Village Settings; and Super Admin village support.

## Historical migration rule

Historical migrations can retain references to old Committee, SOS/Emergency, or correction-request tables/features for migration history. They do not make those features active and must not be used to expand current system scope.

## Diagram/documentation guidance

For a Context Diagram, use one central Process 0, the five actor types above, no data store, and one-way data flows. Do not invent registration approval or include removed features.

For DFD and Use Case diagrams, use the final permission matrix: Assistant = Operations; Headman = Governance + Operations; Super Admin = system administration plus Headman-equivalent village support. Binding must show that an imported matching Person can be explicitly reused rather than duplicated.
