import { getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionContextFromServerCookies();
    if (!session?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const villageIdParam = req.nextUrl.searchParams.get("villageId");

    let targetVillageId: string | null = null;
    if (villageIdParam) {
      const adminMembership = await prisma.villageMembership.findFirst({
        where: {
          userId: session.id,
          villageId: villageIdParam,
          role: { in: ["HEADMAN", "ASSISTANT_HEADMAN", "COMMITTEE"] },
          status: "ACTIVE",
        },
      });

      if (!adminMembership) {
        return NextResponse.json(
          { error: "Forbidden" },
          { status: 403 }
        );
      }

      targetVillageId = villageIdParam;
    } else {
      // Resident mode: use active village membership
      const membership = await prisma.villageMembership.findFirst({
        where: {
          userId: session.id,
          status: "ACTIVE",
        },
      });

      if (!membership) {
        return NextResponse.json(
          { error: "No active village membership" },
          { status: 400 }
        );
      }

      targetVillageId = membership.villageId;
    }

    if (!targetVillageId) {
      return NextResponse.json(
        { error: "Village not found" },
        { status: 400 }
      );
    }

    // Fetch available slots from the user's village that are not blocked
    // and have future dates.
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const slots = await prisma.appointmentSlot.findMany({
      where: {
        villageId: targetVillageId,
        isBlocked: false,
        date: {
          gte: today,
        },
      },
      include: {
        _count: {
          select: {
            appointments: {
              where: {
                stage: {
                  notIn: ["CANCELLED", "REJECTED"],
                },
              },
            },
          },
        },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      take: 200,
    });

    const availableSlots = slots.filter(
      (slot) => slot._count.appointments < slot.maxCapacity
    );

    return NextResponse.json(availableSlots);
  } catch (error) {
    console.error("Error fetching appointment slots:", error);
    return NextResponse.json(
      { error: "Failed to fetch slots" },
      { status: 500 }
    );
  }
}
