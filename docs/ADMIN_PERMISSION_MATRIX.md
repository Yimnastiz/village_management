# Village Admin Permission Matrix — Phase 2A

`src/lib/village-permissions.ts` is the authorization source of truth for the shared `/admin` workspace. Server checks are authoritative.

| Capability | HEADMAN | ASSISTANT_HEADMAN (legacy DB value) |
| --- | :---: | :---: |
| Every currently implemented `/admin` operational and governance permission | Yes | No |
| `/admin` route and server-action authorization | Yes | No |
| Village membership status management for ordinary Residents | Yes | No |
| Live membership role assignment | Retired | Retired |

- Phase 2A makes HEADMAN the sole active village administrator.
- `ASSISTANT_HEADMAN` deliberately remains in the Prisma schema and legacy records for the forthcoming data migration, but grants no runtime administrative access or recipient status.
- Legacy Assistant values remain displayable in membership and historical/audit presentation.
- The separate signed-cookie Super Admin runtime remains transitional and is not part of this `/admin` permission matrix.
- Existing sensitive-action reason requirements remain defined by `src/lib/sensitive-action-policy.ts`.
