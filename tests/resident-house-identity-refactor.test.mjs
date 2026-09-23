import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("House issue ownership stays on the User while admin presentation uses the actor helper", () => {
  const residentActions = source("src/app/(resident)/resident/issues/actions.ts");
  const residentDetail = source("src/app/(resident)/resident/issues/[issueId]/page.tsx");
  const adminList = source("src/app/(admin)/admin/issues/page.tsx");
  const adminDetail = source("src/app/(admin)/admin/issues/[issueId]/page.tsx");
  assert.match(residentActions, /reporterId:\s*session\.id/);
  assert.match(residentActions, /getResidentActorDisplayByUserId/);
  assert.match(residentDetail, /residentActorDisplay/);
  assert.match(adminList, /RESIDENT_ACTOR_USER_SELECT/);
  assert.match(adminDetail, /residentActorDisplay/);
});

test("appointment requester presentation includes House identity and House contact without changing ownership", () => {
  const actions = source("src/app/(resident)/resident/appointments/actions.ts");
  const detail = source("src/app/(admin)/admin/appointments/[appointmentId]/page.tsx");
  const lookup = source("src/app/api/appointments/residents/route.ts");
  assert.match(actions, /userId:\s*session\.id/);
  assert.match(detail, /residentDisplay\.contactPhone/);
  assert.match(detail, /RESIDENT_ACTOR_USER_SELECT/);
  assert.match(lookup, /residentHouseAccount:[\s\S]*contactPhone/);
  assert.doesNotMatch(detail, /user:\s*\{\s*select:\s*\{\s*name:\s*true,\s*email:\s*true,\s*phoneNumber:\s*true/);
});

test("all resident request review modules use the centralized account-kind-aware selection", () => {
  const files = [
    "src/app/(admin)/admin/news/requests/page.tsx",
    "src/app/(admin)/admin/calendar/requests/page.tsx",
    "src/app/(admin)/admin/gallery/submissions/page.tsx",
    "src/app/(admin)/admin/places/requests/page.tsx",
    "src/app/(admin)/admin/contacts/requests/page.tsx",
  ];
  for (const file of files) {
    assert.match(source(file), /RESIDENT_ACTOR_USER_SELECT/, file);
    assert.match(source(file), /residentActorDisplay/, file);
  }
});

test("House dashboard and household registry do not treat the account as a Person", () => {
  const dashboard = source("src/app/(resident)/resident/dashboard/page.tsx");
  const household = source("src/app/(resident)/resident/household/page.tsx");
  const memberDetail = source("src/app/(resident)/resident/household/members/[memberId]/page.tsx");
  assert.match(dashboard, /actorDisplay\.label/);
  assert.match(dashboard, /accountKind === "RESIDENT_HOUSE"/);
  assert.match(dashboard, /effectiveHouseId && session\.accountKind !== "RESIDENT_HOUSE"[\s\S]*villageMembership\.findMany/);
  assert.match(household, /session\.accountKind === "RESIDENT_HOUSE"[\s\S]*Promise\.resolve\(\[\]\)/);
  assert.match(memberDetail, /session\.accountKind !== "RESIDENT_HOUSE"/);
});

test("Binding remains available only to legacy Residents", () => {
  assert.match(source("src/app/(resident)/resident/binding/page.tsx"), /accountKind === "RESIDENT_HOUSE"[\s\S]*redirect\("\/resident\/dashboard"\)/);
  assert.match(source("src/app/(resident)/resident/binding/pending/page.tsx"), /accountKind === "RESIDENT_HOUSE"[\s\S]*redirect\("\/resident\/dashboard"\)/);
});
