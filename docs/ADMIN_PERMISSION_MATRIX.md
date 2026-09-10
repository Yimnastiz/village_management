# Village Admin Permission Matrix — Phase 2A

`src/lib/village-permissions.ts` is the authorization source of truth for the shared `/admin` workspace. Server checks are authoritative.

| Capability | HEADMAN |
| --- | :---: |
| Every currently implemented `/admin` operational and governance permission | Yes |
| `/admin` route and server-action authorization | Yes |
| Village membership status management for ordinary Residents | Yes |
| Live membership role assignment | Retired |

- Phase 2A makes HEADMAN the sole active village administrator.
- The live membership enum contains only HEADMAN and RESIDENT; Headman is the only active `/admin` administrator.
- Legacy Assistant and Super Admin metadata remains displayable only through explicit historical presentation helpers.
- Existing sensitive-action reason requirements remain defined by `src/lib/sensitive-action-policy.ts`.
- All capabilities are constrained to the one server-resolved configured Village; no Village-switching workspace exists.
