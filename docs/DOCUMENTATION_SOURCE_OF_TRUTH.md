# Documentation Source of Truth

The final runtime actors are Public / Guest, Resident, and Headman. Headman is the sole administrator and uses `/admin` for all active administrative work.

Each runtime installation resolves exactly one active Village. Public routing, registration, feedback, and authenticated access are all bound to that configured Village; zero or multiple active Village rows are a configuration error. Legacy Village and membership rows remain historical data and grant no workspace access.

Headman owns Feedback (`/admin/feedback`), Village Broadcasts (`/admin/broadcasts`), Data Quality (`/admin/data-quality`), Audit (`/admin/security`), System Settings (`/admin/settings/system`), Village Settings (`/admin/settings/village`), and the existing village operational modules.

During Maintenance Mode, normal Admin work is blocked while the authenticated Headman may reach `/admin/settings/system` to disable maintenance. No Super Admin recovery path exists.

Phase 4C finalized the three-actor model. There is no Super Admin runtime, no `SystemRole` enum or field, and no Assistant membership enum value. Active authority and current administrative classification derive solely from an ACTIVE HEADMAN membership; RESIDENT and Public flows have no administrative authority. Historical audit, notification, broadcast, issue-message, and appointment metadata can still render legacy Assistant and Super Admin labels through string-based compatibility helpers. `HouseSourceType.SUPERADMIN_CREATED` is intentionally retained only as historical House provenance and is not an active actor or role.
