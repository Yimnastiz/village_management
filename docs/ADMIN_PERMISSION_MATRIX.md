# Village Admin Permission Matrix

The shared `/admin` workspace uses `src/lib/village-permissions.ts` as its authorization source of truth. Server checks are authoritative; hidden UI is only a convenience.

| Capability | HEADMAN | ASSISTANT_HEADMAN |
| --- | :---: | :---: |
| Dashboard | Yes | Yes |
| News, Gallery, Places, Contacts and their request queues | Yes | Yes |
| Downloads, Transparency and Calendar | Yes | Yes |
| Issues and Appointments | Yes | Yes |
| View/manage houses and people; normal population workflows | Yes | Yes |
| Review house-binding requests; directly manage House/Person registry data according to operational permissions | Yes | Yes |
| View members; suspend/reactivate ordinary Residents | Yes | Yes |
| View append-only Audit Log | Yes | Yes |
| Bulk population import | Yes | No |
| Import rollback | Yes | No |
| Sensitive/full population export | Yes | No |
| Assign/remove ASSISTANT_HEADMAN | Yes | No |
| Village settings | Yes | No |
| Manage HEADMAN | No | No |

- HEADMAN = Governance + Operations.
- ASSISTANT_HEADMAN = day-to-day Operations only.
- HEADMAN cannot appoint, remove, or otherwise manage another HEADMAN.
- HEADMAN management is SUPERADMIN-only and is not part of the village-role matrix.
- Registration remains OTP followed by a house-binding request; there is no registration-approval permission.

## Sensitive actions

`src/lib/sensitive-action-policy.ts` is the source of truth. Reject, destructive finalization, remove/suspend, role change, bulk action, sensitive export, and override require a trimmed reason of at least 5 characters. Routine approvals and ordinary CRUD normally do not. Policies also declare audit and affected-user notification intent.

Use `requireActionReason(action, input)` on the server and the shared `ActionReasonDialog` in `/admin` UI. Audit data should include `actorRole`, `policyAction`, target, normalized reason, and useful structured metadata.

Reason-required categories currently enforced include request rejection, content delete/archive, issue rejection/final closure/cancellation, appointment cancellation/time rejection, Resident suspension/reactivation, Assistant role assignment/removal, population move-out/deactivation/delete, import, rollback, sensitive export, and mismatch/conflict override.

Route layouts and page loaders protect restricted governance data; server actions and API handlers repeat the authoritative permission check. The sidebar consumes the same matrix. `/admin` remains the only village-admin application.
