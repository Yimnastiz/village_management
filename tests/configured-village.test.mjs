import test from "node:test";
import assert from "node:assert/strict";
import { ConfiguredVillageError, resolveConfiguredVillage } from "../src/lib/configured-village-core.js";

test("configured Village resolver returns the only active Village", () => {
  const village = { id: "village-1", isActive: true };
  assert.equal(resolveConfiguredVillage([village]), village);
});

test("configured Village resolver rejects an installation with no active Village", () => {
  assert.throws(() => resolveConfiguredVillage([]), (error) => error instanceof ConfiguredVillageError && error.code === "MISSING");
});

test("configured Village resolver rejects an installation with multiple active Villages", () => {
  assert.throws(
    () => resolveConfiguredVillage([{ id: "village-1", isActive: true }, { id: "village-2", isActive: true }]),
    (error) => error instanceof ConfiguredVillageError && error.code === "MULTIPLE",
  );
});
