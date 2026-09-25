import type { AccountKind } from "@prisma/client";

export type AccountKindValue = AccountKind | undefined;

export function isHeadmanAccount(accountKind: AccountKindValue): accountKind is "HEADMAN" {
  return accountKind === "HEADMAN";
}

export function isResidentHouseAccount(accountKind: AccountKindValue): accountKind is "RESIDENT_HOUSE" {
  return accountKind === "RESIDENT_HOUSE";
}
