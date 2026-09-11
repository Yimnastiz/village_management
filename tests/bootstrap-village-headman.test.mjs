import test from "node:test";
import assert from "node:assert/strict";
import { BootstrapInputError, planVillageBootstrap, readBootstrapInput } from "../scripts/bootstrap-village-headman-core.mjs";

const headmanEnvironment = { BOOTSTRAP_HEADMAN_PHONE: "0812345678", BOOTSTRAP_HEADMAN_NAME: "Initial Headman" };
const villageEnvironment = { ...headmanEnvironment, BOOTSTRAP_VILLAGE_NAME: "Example Village", BOOTSTRAP_VILLAGE_SLUG: "example-village", BOOTSTRAP_VILLAGE_MOO: "1", BOOTSTRAP_VILLAGE_PROVINCE: "Example Province", BOOTSTRAP_VILLAGE_DISTRICT: "Example District", BOOTSTRAP_VILLAGE_SUBDISTRICT: "Example Subdistrict" };

test("zero active Villages requires complete Village creation input", () => {
  const input = readBootstrapInput(headmanEnvironment);
  assert.throws(() => planVillageBootstrap([], input.village), (error) => error instanceof BootstrapInputError && error.code === "MISSING_VILLAGE_INPUT");
});

test("one active Village is reused without creating another", () => {
  const input = readBootstrapInput(headmanEnvironment);
  const activeVillage = { id: "village-1", name: "Existing", slug: "existing", moo: null, province: null, district: null, subdistrict: null };
  assert.deepEqual(planVillageBootstrap([activeVillage], input.village), { kind: "existing", village: activeVillage });
});

test("multiple active Villages are rejected without choosing one", () => {
  const input = readBootstrapInput(headmanEnvironment);
  assert.throws(() => planVillageBootstrap([{ id: "one" }, { id: "two" }], input.village), (error) => error instanceof BootstrapInputError && error.code === "MULTIPLE_ACTIVE_VILLAGES");
});

test("complete bootstrap input is valid for Village creation", () => {
  const input = readBootstrapInput(villageEnvironment);
  assert.equal(planVillageBootstrap([], input.village).kind, "create");
});

test("invalid phone, missing Headman name, and invalid slug are rejected", () => {
  assert.throws(() => readBootstrapInput({ ...villageEnvironment, BOOTSTRAP_HEADMAN_PHONE: "123" }), (error) => error instanceof BootstrapInputError && error.code === "INVALID_PHONE");
  assert.throws(() => readBootstrapInput({ ...villageEnvironment, BOOTSTRAP_HEADMAN_NAME: " " }), (error) => error instanceof BootstrapInputError && error.code === "MISSING_INPUT");
  assert.throws(() => readBootstrapInput({ ...villageEnvironment, BOOTSTRAP_VILLAGE_SLUG: "???" }), (error) => error instanceof BootstrapInputError && error.code === "INVALID_SLUG");
});
