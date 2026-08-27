# Village Admin Permission Matrix

The shared `/admin` workspace uses `src/lib/village-permissions.ts` as its authorization source of truth. Server checks are authoritative; hidden UI is only a convenience.

| Capability | HEADMAN | ASSISTANT_HEADMAN |
| --- | :---: | :---: |
| Dashboard, operational content, requests, issues, appointments | ✓ | ✓ |
| View/manage houses and people; normal population workflows | ✓ | ✓ |
| Binding and population-correction review | ✓ | ✓ |
| View members; suspend/reactivate ordinary Residents | ✓ | ✓ |
| View append-only Audit Log | ✓ | ✓ |
| Bulk population import | ✓ | — |
| Import rollback | ✓ | — |
| Sensitive/full population export | ✓ | — |
| Assign/remove ASSISTANT_HEADMAN | ✓ | — |
| Village settings | ✓ | — |

- HEADMAN = Governance + Operations.
- ASSISTANT_HEADMAN = day-to-day Operations only.
- HEADMAN cannot appoint, remove, or otherwise manage another HEADMAN.
- HEADMAN management is SUPERADMIN-only and is not part of the village-role matrix.
- Registration remains OTP followed by a house-binding request; there is no registration-approval permission.

## Sensitive actions

`src/lib/sensitive-action-policy.ts` is the source of truth. Reject, destructive finalization, remove/suspend, role change, bulk action, sensitive export, and override require a trimmed reason of at least 5 characters. Routine approvals and ordinary CRUD normally do not. Policies also declare audit and affected-user notification intent.

Use `requireActionReason(action, input)` on the server and the shared `ActionReasonDialog` in `/admin` UI. Audit data should include `actorRole`, `policyAction`, target, normalized reason, and useful structured metadata.
