# System Actors

The active actors are exactly:

1. Public / Guest
2. Resident
3. Headman

Headman is the sole active `/admin` administrator. The live Prisma membership enum contains only `HEADMAN` and `RESIDENT`; there is no `SystemRole` field or enum. Historical metadata may still contain legacy Assistant and Super Admin strings for presentation only, and those strings grant no runtime privileges.
