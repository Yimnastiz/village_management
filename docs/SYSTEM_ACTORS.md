# System Actors

The authoritative current-scope reference is [DOCUMENTATION_SOURCE_OF_TRUTH.md](DOCUMENTATION_SOURCE_OF_TRUTH.md). This file is a short actor index.

The active actors are exactly:

1. Public / Guest
2. Resident
3. Headman
4. Assistant Headman
5. Super Admin

Public represents an unauthenticated guest.

Removed from the current system scope:

- Village Committee role
- SOS/Emergency incident feature
- Post-resolution issue rating/scoring
- HouseholdCorrectionRequest / Resident population-correction-request workflow

Registration creates an account after OTP verification. Headman and Assistant Headman review subsequent house-binding requests; they do not approve user registration.

Residents cannot submit population or household correction requests through the system. If registry information is incorrect, the Resident contacts the Headman or Assistant Headman, who performs authorized corrections directly through the Admin population-management functions.

Headman and Assistant Headman permissions are defined by the current [Admin Permission Matrix](ADMIN_PERMISSION_MATRIX.md).
