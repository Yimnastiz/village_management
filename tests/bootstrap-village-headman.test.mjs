import test from "node:test";
import assert from "node:assert/strict";
import { BootstrapInputError, planVillageBootstrap, readBootstrapInput } from "../scripts/bootstrap-village-headman-core.mjs";

const headmanEnvironment = { BOOTSTRAP_HEADMAN_EMAIL: "Headman@Example.COM", BOOTSTRAP_HEADMAN_PHONE: "0812345678", BOOTSTRAP_HEADMAN_NAME: "Initial Headman" };
const catalogVillage = { id: "catalog-1", officialCode: "66080210", villageName: "เขาทราย", slug: "เขาทราย-10-66080210", moo: "10", province: "พิจิตร", district: "ทับคล้อ", subdistrict: "เขาทราย" };

test("zero active Villages derives the Village from the catalog identity", () => {
  const input = readBootstrapInput(headmanEnvironment);
  assert.equal(input.headman.name, "Initial Headman");
  assert.deepEqual(planVillageBootstrap([], catalogVillage), { kind: "create", village: { name: "เขาทราย", slug: "เขาทราย-10-66080210", moo: "10", province: "พิจิตร", district: "ทับคล้อ", subdistrict: "เขาทราย", catalogVillageId: "catalog-1" } });
});

test("one active Village is reused without creating another", () => {
  const input = readBootstrapInput(headmanEnvironment);
  const activeVillage = { id: "village-1", catalogVillageId: "catalog-1" };
  assert.equal(input.headman.phoneNumber, "0812345678");
  assert.equal(input.headman.email, "headman@example.com");
  assert.deepEqual(planVillageBootstrap([activeVillage], catalogVillage), { kind: "existing", village: activeVillage });
});

test("multiple active Villages are rejected without choosing one", () => {
  assert.throws(() => planVillageBootstrap([{ id: "one" }, { id: "two" }], catalogVillage), (error) => error instanceof BootstrapInputError && error.code === "MULTIPLE_ACTIVE_VILLAGES");
});

test("a mismatched active Village is rejected without modification", () => {
  assert.throws(() => planVillageBootstrap([{ id: "village-10", catalogVillageId: "catalog-10" }], catalogVillage), (error) => error instanceof BootstrapInputError && error.code === "VILLAGE_CATALOG_MISMATCH");
});

test("invalid email, invalid phone, and missing Headman name are rejected", () => {
  assert.throws(() => readBootstrapInput({ ...headmanEnvironment, BOOTSTRAP_HEADMAN_EMAIL: "invalid" }), (error) => error instanceof BootstrapInputError && error.code === "INVALID_EMAIL");
  assert.throws(() => readBootstrapInput({ ...headmanEnvironment, BOOTSTRAP_HEADMAN_PHONE: "123" }), (error) => error instanceof BootstrapInputError && error.code === "INVALID_PHONE");
  assert.throws(() => readBootstrapInput({ ...headmanEnvironment, BOOTSTRAP_HEADMAN_NAME: " " }), (error) => error instanceof BootstrapInputError && error.code === "MISSING_INPUT");
});
