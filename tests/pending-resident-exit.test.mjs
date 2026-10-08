import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("pending exit clears only opening access and preserves the request", async () => {
  const route = await read("../src/app/api/auth/pending-resident/exit/route.ts");
  const button = await read("../src/components/layout/pending-exit-button.tsx");
  assert.match(route, /clearHouseOpeningAccessCookie\(response\)/u);
  assert.doesNotMatch(route, /signOutCurrentSession|houseAccountOpeningRequest\.update|delete/u);
  assert.match(button, /pending-resident\/exit/u);
  assert.match(button, /window\.location\.replace\("\/auth\/login"\)/u);
});

test("active logout remains separate from pending exit", async () => {
  const topBar = await read("../src/components/layout/top-bar.tsx");
  assert.match(topBar, /isPendingResident \? <PendingExitButton \/> : <LogoutButton mode="menu" \/>/u);
  assert.match(topBar, /PendingExitButton \/> : <LogoutButton mode="menu" \/>/u);
});
