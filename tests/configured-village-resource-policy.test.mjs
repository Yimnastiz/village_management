import test from "node:test";
import assert from "node:assert/strict";
import {
  belongsToConfiguredVillage,
  belongsToConfiguredVillageResource,
} from "../src/lib/configured-village-resource-policy.js";

test("configured Village storage policy rejects a legacy Village key", () => {
  assert.equal(
    belongsToConfiguredVillageResource(
      "places/village-a/11223344-5566-7788-99aa-bbccddeeff00.jpg",
      "places",
      "village-a"
    ),
    true
  );
  assert.equal(
    belongsToConfiguredVillageResource(
      "places/village-b/11223344-5566-7788-99aa-bbccddeeff00.jpg",
      "places",
      "village-a"
    ),
    false
  );
  assert.equal(belongsToConfiguredVillageResource("places/village-a", "places", "village-a"), false);
});

test("configured Village record policy rejects a legacy Village record", () => {
  assert.equal(belongsToConfiguredVillage("village-a", "village-a"), true);
  assert.equal(belongsToConfiguredVillage("village-b", "village-a"), false);
});
