import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getConfiguredVillage } from "@/lib/configured-village";
import {
  HOUSE_OPENING_ACCESS_COOKIE,
  verifyHouseOpeningAccessToken,
} from "@/lib/house-account-opening-access";
import { isPendingResidentRequestEligible } from "@/lib/pending-resident-policy";

export type PendingResidentContext = {
  accessMode: "PENDING_RESIDENT";
  requestId: string;
  villageId: string;
  houseId: string;
  houseNumber: string;
  applicantName: string;
  verifiedEmail: string;
};

export type PendingResidentAccessResult =
  | { kind: "PENDING"; context: PendingResidentContext }
  | { kind: "TERMINAL"; status: "APPROVED" | "REJECTED" | "CANCELLED" | "EXPIRED" }
  | { kind: "DENIED" };

async function inspectToken(token: string | null | undefined): Promise<PendingResidentAccessResult> {
  const signedAccess = verifyHouseOpeningAccessToken(token);
  if (!signedAccess) return { kind: "DENIED" };

  const [configuredVillage, openingRequest] = await Promise.all([
    getConfiguredVillage(),
    prisma.houseAccountOpeningRequest.findUnique({
      where: { id: signedAccess.requestId },
      select: {
        id: true,
        villageId: true,
        houseId: true,
        applicantFirstName: true,
        applicantLastName: true,
        emailSnapshot: true,
        status: true,
        house: { select: { houseNumber: true } },
        initialEmail: { select: { verifiedAt: true } },
      },
    }),
  ]);

  if (!openingRequest || openingRequest.villageId !== configuredVillage.id) return { kind: "DENIED" };
  if (["APPROVED", "REJECTED", "CANCELLED", "EXPIRED"].includes(openingRequest.status)) {
    return { kind: "TERMINAL", status: openingRequest.status as "APPROVED" | "REJECTED" | "CANCELLED" | "EXPIRED" };
  }
  if (!isPendingResidentRequestEligible({
    requestStatus: openingRequest.status,
    requestVillageId: openingRequest.villageId,
    configuredVillageId: configuredVillage.id,
    emailVerifiedAt: openingRequest.initialEmail?.verifiedAt ?? null,
  })) return { kind: "DENIED" };

  return {
    kind: "PENDING",
    context: {
      accessMode: "PENDING_RESIDENT",
      requestId: openingRequest.id,
      villageId: openingRequest.villageId,
      houseId: openingRequest.houseId,
      houseNumber: openingRequest.house.houseNumber,
      applicantName: `${openingRequest.applicantFirstName} ${openingRequest.applicantLastName}`.trim(),
      verifiedEmail: openingRequest.emailSnapshot,
    },
  };
}

export async function inspectPendingResidentAccessFromRequest(
  request: NextRequest,
): Promise<PendingResidentAccessResult> {
  return inspectToken(request.cookies.get(HOUSE_OPENING_ACCESS_COOKIE)?.value);
}

export async function inspectPendingResidentAccessFromServerCookies(): Promise<PendingResidentAccessResult> {
  const cookieStore = await cookies();
  return inspectToken(cookieStore.get(HOUSE_OPENING_ACCESS_COOKIE)?.value);
}

export async function getPendingResidentContextFromServerCookies(): Promise<PendingResidentContext | null> {
  const result = await inspectPendingResidentAccessFromServerCookies();
  return result.kind === "PENDING" ? result.context : null;
}
