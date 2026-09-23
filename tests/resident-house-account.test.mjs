import test from "node:test";
import assert from "node:assert/strict";
import {
  assertResidentHouseAccountVillageConsistency,
  ResidentHouseAccountInvariantError,
} from "../src/lib/resident-house-account.ts";

function houseLookup(result) {
  return {
    house: {
      findUnique: async () => result,
    },
  };
}

test("Resident House Account accepts the persisted House Village", async () => {
  await assert.doesNotReject(
    assertResidentHouseAccountVillageConsistency(
      houseLookup({ villageId: "village-1" }),
      { houseId: "house-1", villageId: "village-1" },
    ),
  );
});

test("Resident House Account rejects a cross-Village House", async () => {
  await assert.rejects(
    assertResidentHouseAccountVillageConsistency(
      houseLookup({ villageId: "village-2" }),
      { houseId: "house-1", villageId: "village-1" },
    ),
    (error) => error instanceof ResidentHouseAccountInvariantError
      && error.code === "HOUSE_VILLAGE_MISMATCH",
  );
});

test("Resident House Account rejects a missing House", async () => {
  await assert.rejects(
    assertResidentHouseAccountVillageConsistency(
      houseLookup(null),
      { houseId: "missing-house", villageId: "village-1" },
    ),
    (error) => error instanceof ResidentHouseAccountInvariantError
      && error.code === "HOUSE_NOT_FOUND",
  );
});
