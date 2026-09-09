# Documentation Source of Truth

The final runtime actors are Public / Guest, Resident, and Headman. Headman is the sole administrator and uses `/admin` for all active administrative work.

Headman owns Feedback (`/admin/feedback`), Village Broadcasts (`/admin/broadcasts`), Data Quality (`/admin/data-quality`), Audit (`/admin/security`), System Settings (`/admin/settings/system`), Village Settings (`/admin/settings/village`), and the existing village operational modules.

During Maintenance Mode, normal Admin work is blocked while the authenticated Headman may reach `/admin/settings/system` to disable maintenance. No Super Admin recovery path exists.

Phase 4A removed the Super Admin route, API, access-code, cookie, and bootstrap runtime. Historical audit, notification, broadcast, and issue-message presentation continues to recognize legacy Super Admin metadata. Prisma's `SystemRole.SUPERADMIN`, `VillageMembershipRole.ASSISTANT_HEADMAN`, and legacy source values remain temporarily for the later Phase 4C schema/data migration; they grant no runtime authority.
