import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { MEMBERSHIP_ROLE_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const session = await getSessionContextFromServerCookies();
    if (!session?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const membership = getResidentMembership(session);
    if (!membership) {
      return NextResponse.json({ error: "No active village membership" }, { status: 400 });
    }

    const admins = await prisma.villageMembership.findMany({
      where: {
        villageId: membership.villageId,
        status: "ACTIVE",
        role: { in: ["HEADMAN", "ASSISTANT_HEADMAN", "COMMITTEE"] },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phoneNumber: true,
          },
        },
      },
      orderBy: [{ role: "asc" }, { user: { name: "asc" } }],
    });

    return NextResponse.json(
      admins.map((admin) => ({
        id: admin.user.id,
        name: admin.user.name,
        phoneNumber: admin.user.phoneNumber,
        role: admin.role,
        roleLabel: MEMBERSHIP_ROLE_LABELS[admin.role] ?? admin.role,
      }))
    );
  } catch (error) {
    console.error("Error fetching appointment admin recipients:", error);
    return NextResponse.json({ error: "Failed to fetch recipients" }, { status: 500 });
  }
}
