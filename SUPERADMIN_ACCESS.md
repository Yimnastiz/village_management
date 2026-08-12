# Super Admin access

Super Admin is an environment-operated system role and is not a Better Auth user.

1. Set `SUPERADMIN_ACCESS_CODE` to a long, random access code.
2. Set `SUPERADMIN_SESSION_SECRET` to a separate long, random signing secret.
3. Open `/superadmin` and enter the access code.

The session lasts 12 hours and is stored only in the HttpOnly `village_superadmin_session` cookie. The former bootstrap flow at `/superadmin/setup` is no longer an authentication path.
