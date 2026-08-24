import { ContactRequestStatus, ContactRequestType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ContactProvenance =
  | { source: "ADMIN_MANUAL" }
  | {
      source: "RESIDENT_REQUESTED";
      requestId: string;
      requesterId: string;
      requesterName: string;
    };

/**
 * Finds the durable resident-origin trace for one contact in one village.
 * Legacy contacts without that approved CREATE record are intentionally treated
 * as administrator-managed records.
 */
export async function getContactProvenance(
  villageId: string,
  contactId: string,
): Promise<ContactProvenance> {
  const request = await prisma.contactRequest.findFirst({
    where: {
      villageId,
      type: ContactRequestType.CREATE,
      status: ContactRequestStatus.APPROVED,
      approvedContactId: contactId,
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      requesterId: true,
      requester: { select: { name: true } },
    },
  });

  if (!request) return { source: "ADMIN_MANUAL" };
  return {
    source: "RESIDENT_REQUESTED",
    requestId: request.id,
    requesterId: request.requesterId,
    requesterName: request.requester.name,
  };
}
