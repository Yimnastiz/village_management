"use server";

import { AuditAction, HouseholdOccupancyStatus, HouseSourceType, MembershipStatus, VillageMembershipRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { isValidHouseNumber, normalizeHouseNumber } from "@/lib/house-number";
import { prisma } from "@/lib/prisma";

export async function createHouseAction(formData: FormData) {
  const session = await getSessionContextFromServerCookies();
  if (!session || !isAdminUser(session)) throw new Error("Unauthorized");
  const membership = session.memberships.find((item) => item.status === MembershipStatus.ACTIVE && item.role !== VillageMembershipRole.RESIDENT);
  if (!membership) throw new Error("Unauthorized");
  const display = typeof formData.get("houseNumber") === "string" ? formData.get("houseNumber")!.toString() : "";
  const normalized = normalizeHouseNumber(display);
  if (!isValidHouseNumber(normalized)) throw new Error("รูปแบบเลขบ้านไม่ถูกต้อง");
  try {
    const house = await prisma.house.create({ data: { villageId: membership.villageId, houseNumber: display.trim(), normalizedHouseNumber: normalized, address: typeof formData.get("address") === "string" ? formData.get("address")!.toString().trim() || null : null, occupancyStatus: (formData.get("occupancyStatus")?.toString() as HouseholdOccupancyStatus) || HouseholdOccupancyStatus.OCCUPIED, sourceType: HouseSourceType.ADMIN_CREATED, verifiedByUserId: session.id, verifiedAt: new Date() } });
    await prisma.auditLog.create({ data: { userId: session.id, villageId: membership.villageId, action: AuditAction.CREATE, resource: "House", resourceId: house.id, metadata: { actionName: "HOUSE_CREATED_BY_ADMIN", houseNumber: house.houseNumber, normalizedHouseNumber: normalized } } });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") throw new Error("เลขบ้านนี้มีอยู่แล้วในหมู่บ้าน");
    throw error;
  }
  revalidatePath("/admin/population/houses");
}
