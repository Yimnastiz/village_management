import { getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ appointmentId: string }> }
) {
  try {
    const session = await getSessionContextFromServerCookies();
    if (!session?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { appointmentId } = await params;

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        user: {
          select: { email: true, name: true },
        },
        slot: true,
        timeline: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!appointment) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      );
    }

    // Verify user has access (is admin of the village or is the appointment requester)
    const isAdmin = await prisma.villageMembership.findFirst({
      where: {
        userId: session.id,
        villageId: appointment.villageId,
        role: { in: ["HEADMAN", "ASSISTANT_HEADMAN", "COMMITTEE"] },
      },
    });

    const isOwner = appointment.userId === session.id;

    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    return NextResponse.json(appointment);
  } catch (error) {
    console.error("Error fetching appointment:", error);
    return NextResponse.json(
      { error: "Failed to fetch appointment" },
      { status: 500 }
    );
  }
}
