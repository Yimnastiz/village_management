import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminActionSession } from "@/lib/superadmin";

export async function GET(request: NextRequest, { params }: { params: Promise<{ villageId: string }> }) {
  try {
    await requireSuperAdminActionSession();
    const { villageId } = await params;
    const village = await prisma.village.findUnique({ where: { id: villageId }, select: { id: true } });
    if (!village) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const rows = await prisma.villageMembership.findMany({
      where: { villageId, status: "ACTIVE", role: "RESIDENT", ...(q ? { OR: [{ user: { name: { contains: q, mode: "insensitive" } } }, { user: { phoneNumber: { contains: q } } }, { house: { houseNumber: { contains: q } } }] } : {}) },
      select: { userId: true, user: { select: { name: true, phoneNumber: true } }, house: { select: { houseNumber: true } } },
      take: 25,
      orderBy: { user: { name: "asc" } },
    });
    return NextResponse.json(rows.map((row) => ({ id: row.userId, name: row.user.name, phone: row.user.phoneNumber, houseNumber: row.house?.houseNumber ?? "" })));
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}
