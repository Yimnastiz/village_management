import type { Prisma, PrismaClient } from "@prisma/client";

type HouseLookupClient = Pick<PrismaClient, "house"> | Pick<Prisma.TransactionClient, "house">;

export class ResidentHouseAccountInvariantError extends Error {
  readonly code: "HOUSE_NOT_FOUND" | "HOUSE_VILLAGE_MISMATCH";

  constructor(
    code: "HOUSE_NOT_FOUND" | "HOUSE_VILLAGE_MISMATCH",
    message: string,
  ) {
    super(message);
    this.name = "ResidentHouseAccountInvariantError";
    this.code = code;
  }
}

/**
 * Validate Village ownership using the persisted House row, never a client
 * supplied House/Village pair. Call this inside the later mutation transaction.
 */
export async function assertResidentHouseAccountVillageConsistency(
  db: HouseLookupClient,
  input: { houseId: string; villageId: string },
): Promise<void> {
  const house = await db.house.findUnique({
    where: { id: input.houseId },
    select: { villageId: true },
  });

  if (!house) {
    throw new ResidentHouseAccountInvariantError("HOUSE_NOT_FOUND", "House does not exist.");
  }

  if (house.villageId !== input.villageId) {
    throw new ResidentHouseAccountInvariantError(
      "HOUSE_VILLAGE_MISMATCH",
      "Resident House Account and House must belong to the same Village.",
    );
  }
}
