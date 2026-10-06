# System Actors

The final formal actors are exactly:

1. สมาชิก (Resident)
2. ผู้ใหญ่บ้าน (Headman)

There is no Public / Guest actor in the formal system analysis or documentation. Public HTTP accessibility is a route/access concern, not a third actor.

Resident-side lifecycle functions may begin before authentication. In particular, requesting a บัญชีประจำบ้าน (House Account), submitting feedback or complaints, and reporting a website error may remain available through unauthenticated pages. These flows are grouped under สมาชิก (Resident) in the formal Use Case model, even when the requester does not yet have an activated account.

Headman is the sole active `/admin` administrator. The live Prisma membership enum contains only `HEADMAN` and `RESIDENT`; there is no `SystemRole` field or enum. Historical metadata may still contain legacy Assistant and Super Admin strings for presentation only, and those strings grant no runtime privileges.

The account architecture remains one Village installation; one House has at most one Resident House Account, and one Resident House Account maps to one underlying Resident User. Multiple verified อีเมลสำหรับเข้าสู่ระบบ may access the same House Account. Person/population records are data, not authentication identities. Resident and Headman login use email plus an email verification code, with the server determining account type.

The final actor model does not remove public village information, `/auth/register`, feedback, complaint, or website-error routes, and does not require authentication solely to satisfy the formal actor model. All active actors operate only within the single server-resolved configured Village. Legacy memberships in other Village rows do not grant access to an active workspace.
