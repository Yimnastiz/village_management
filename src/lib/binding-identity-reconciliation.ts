import type { Prisma } from "@prisma/client";
import { normalizeNationalId } from "@/lib/thai-identity";
import { prisma } from "@/lib/prisma";

type BindingIdentityDb = typeof prisma | Prisma.TransactionClient;

export type BindingIdentityPerson = {
  id: string;
  userId: string | null;
  firstName: string;
  lastName: string;
  nationalId: string | null;
  dateOfBirth: Date | null;
  phone: string | null;
  houseId: string | null;
  house: {
    houseNumber: string;
    sourceType: string;
    sourceNote: string | null;
  } | null;
};

export type BindingIdentityReconciliation =
  | { kind: "no_match"; nationalId: string | null; matches: [] }
  | { kind: "single_unlinked_match"; nationalId: string; matches: [BindingIdentityPerson]; person: BindingIdentityPerson }
  | { kind: "multiple_matches"; nationalId: string; matches: BindingIdentityPerson[] }
  | { kind: "linked_to_another_user"; nationalId: string; matches: [BindingIdentityPerson]; person: BindingIdentityPerson }
  | { kind: "already_linked_to_applicant"; nationalId: string; matches: [BindingIdentityPerson]; person: BindingIdentityPerson };

/**
 * The canonical binding identity lookup. A Thai National ID is only meaningful
 * within the village that owns the binding request, so every reviewer uses this
 * exact same-village match rather than a name, phone, or house heuristic.
 */
export async function reconcileBindingPersonIdentity(
  db: BindingIdentityDb,
  { villageId, nationalId, applicantUserId }: { villageId: string; nationalId: string | null | undefined; applicantUserId: string },
): Promise<BindingIdentityReconciliation> {
  const normalizedNationalId = nationalId ? normalizeNationalId(nationalId) : "";
  if (!normalizedNationalId) return { kind: "no_match", nationalId: null, matches: [] };

  const matches = await db.person.findMany({
    where: { villageId, nationalId: normalizedNationalId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      userId: true,
      firstName: true,
      lastName: true,
      nationalId: true,
      dateOfBirth: true,
      phone: true,
      houseId: true,
      house: { select: { houseNumber: true, sourceType: true, sourceNote: true } },
    },
  });

  if (!matches.length) return { kind: "no_match", nationalId: normalizedNationalId, matches: [] };
  if (matches.length > 1) return { kind: "multiple_matches", nationalId: normalizedNationalId, matches };

  const person = matches[0];
  if (!person.userId) return { kind: "single_unlinked_match", nationalId: normalizedNationalId, matches: [person], person };
  if (person.userId === applicantUserId) return { kind: "already_linked_to_applicant", nationalId: normalizedNationalId, matches: [person], person };
  return { kind: "linked_to_another_user", nationalId: normalizedNationalId, matches: [person], person };
}

export const BINDING_DUPLICATE_PERSON_MESSAGE = "พบข้อมูลบุคคลซ้ำในทะเบียน กรุณาตรวจสอบข้อมูลประชากรก่อนดำเนินการต่อ";
export const BINDING_LINKED_PERSON_MESSAGE = "ข้อมูลบุคคลนี้ถูกผูกกับบัญชีอื่นแล้ว ไม่สามารถผูกทับได้";
