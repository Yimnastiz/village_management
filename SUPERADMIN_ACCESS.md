# Super Admin access

Super Admin is an environment-operated system role and is not a Better Auth user.

For local development, copy the following values into `.env.local` (do not commit that file):

```env
SUPERADMIN_ACCESS_CODE="123456"
SUPERADMIN_SESSION_SECRET="dev-superadmin-session-secret-change-this"
```

Use a long, random access code and a separate long signing secret outside local development. After changing `.env.local`, restart the server; Fast Refresh does not reliably reload server-side environment variables:

```bash
Ctrl + C
npm run dev
```

Then open `/superadmin` and enter the access code.

The session lasts 12 hours and is stored only in the HttpOnly `village_superadmin_session` cookie. The former bootstrap flow at `/superadmin/setup` is no longer an authentication path.
