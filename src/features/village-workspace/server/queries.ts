import { MembershipStatus, Prisma, VillageMembershipRole } from "@prisma/client";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

function parseActiveMembershipRole(value?: string): VillageMembershipRole | undefined {
  if (!value || value === "ALL") return undefined;
  if (value === VillageMembershipRole.HEADMAN) return VillageMembershipRole.HEADMAN;
  if (value === VillageMembershipRole.ASSISTANT_HEADMAN) return VillageMembershipRole.ASSISTANT_HEADMAN;
  if (value === VillageMembershipRole.RESIDENT) return VillageMembershipRole.RESIDENT;
  throw new Error("Invalid village membership role filter.");
}

export async function getWorkspaceVillage(villageId: string) {
  const village = await prisma.village.findUnique({
    where: { id: villageId },
    select: {
      id: true,
      slug: true,
      name: true,
      moo: true,
      subdistrict: true,
      district: true,
      province: true,
      isActive: true,
    },
  });
  if (!village) notFound();
  return village;
}

export async function getVillageEligibleAdminUsers(villageId: string) {
  return prisma.user.findMany({
    where: {
      accountStatus: "ACTIVE",
      systemRole: { not: "SUPERADMIN" },
      OR: [
        { memberships: { some: { villageId } } },
        { registrationVillageId: villageId },
      ],
    },
    orderBy: { name: "asc" },
    take: 200,
    select: {
      id: true,
      name: true,
      phoneNumber: true,
      memberships: {
        where: { villageId },
        take: 1,
        select: { role: true, status: true },
      },
    },
  });
}

export async function getVillageMembers(
  villageId: string,
  input: { query?: string; role?: string; status?: string; adminOnly?: boolean } = {},
) {
  const query = input.query?.trim() ?? "";
  const role = parseActiveMembershipRole(input.role);
  const roles = input.adminOnly
    ? [VillageMembershipRole.HEADMAN, VillageMembershipRole.ASSISTANT_HEADMAN]
    : undefined;
  if (input.adminOnly && role === VillageMembershipRole.RESIDENT) {
    throw new Error("Invalid village administrator role filter.");
  }
  const where: Prisma.VillageMembershipWhereInput = {
    villageId,
    ...(roles ? { role: { in: roles } } : {}),
    ...(role ? { role } : {}),
    ...(input.status && input.status !== "ALL" ? { status: input.status as MembershipStatus } : {}),
    ...(query
      ? {
          OR: [
            { user: { is: { name: { contains: query, mode: "insensitive" } } } },
            { user: { is: { phoneNumber: { contains: query, mode: "insensitive" } } } },
            { house: { is: { houseNumber: { contains: query, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.villageMembership.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        role: true,
        status: true,
        joinedAt: true,
        updatedAt: true,
        houseId: true,
        house: { select: { houseNumber: true } },
        user: { select: { id: true, name: true, phoneNumber: true, accountStatus: true } },
      },
    }),
    prisma.villageMembership.count({ where }),
  ]);
  const orderedRows = input.adminOnly
    ? rows.sort((a, b) => (a.role === VillageMembershipRole.HEADMAN ? -1 : b.role === VillageMembershipRole.HEADMAN ? 1 : b.updatedAt.getTime() - a.updatedAt.getTime()))
    : rows;
  return { rows: orderedRows, total };
}

export async function getVillageDashboard(villageId: string) {
  const adminRoles = [VillageMembershipRole.HEADMAN, VillageMembershipRole.ASSISTANT_HEADMAN];
  const [activeMembers, houses, people, pendingBindings, openIssues, pendingAppointments, admins, recentIssues, recentAppointments, recentAudit] = await Promise.all([
    prisma.villageMembership.count({ where: { villageId, status: MembershipStatus.ACTIVE } }),
    prisma.house.count({ where: { villageId } }),
    prisma.person.count({ where: { villageId } }),
    prisma.bindingRequest.count({ where: { villageId, status: "PENDING" } }),
    prisma.issue.count({ where: { villageId, stage: { in: ["OPEN", "IN_PROGRESS", "WAITING"] } } }),
    prisma.appointment.count({ where: { villageId, stage: { in: ["PENDING_APPROVAL", "TIME_SUGGESTED"] } } }),
    prisma.villageMembership.count({ where: { villageId, role: { in: adminRoles }, status: MembershipStatus.ACTIVE } }),
    prisma.issue.findMany({ where: { villageId }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, title: true, stage: true, createdAt: true } }),
    prisma.appointment.findMany({ where: { villageId }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, title: true, stage: true, scheduledAt: true, createdAt: true } }),
    prisma.auditLog.findMany({ where: { villageId }, orderBy: { createdAt: "desc" }, take: 6, select: { id: true, action: true, resource: true, resourceId: true, createdAt: true, user: { select: { name: true } } } }),
  ]);
  return { activeMembers, houses, people, pendingBindings, openIssues, pendingAppointments, admins, recentIssues, recentAppointments, recentAudit };
}

export function maskPhone(phone: string | null | undefined) {
  if (!phone) return "-";
  if (phone.length < 7) return `${phone.slice(0, 2)}•••`;
  return `${phone.slice(0, 2)}••••${phone.slice(-4)}`;
}
