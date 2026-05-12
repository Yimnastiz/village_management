import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const validateHeadmanSchema = z.object({
  phoneNumber: z.string().trim().regex(/^\d{10}$/),
  nationalId: z.string().trim().regex(/^\d{13}$/),
  province: z.string().trim().min(1),
  district: z.string().trim().min(1),
  subdistrict: z.string().trim().min(1),
  villageId: z.string().trim().min(1),
});

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  const parsed = validateHeadmanSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "ข้อมูลไม่ถูกต้อง" },
      { status: 400 }
    );
  }

  const { phoneNumber, nationalId, province, district, subdistrict, villageId } = parsed.data;

  // Check if village exists and matches the provided location
  const selectedVillage = await prisma.village.findUnique({
    where: { id: villageId },
    select: {
      id: true,
      province: true,
      district: true,
      subdistrict: true,
    },
  });

  if (!selectedVillage) {
    return NextResponse.json({ error: "ไม่พบหมู่บ้านที่เลือก" }, { status: 404 });
  }

  // Validate that the provided location matches the village
  if (
    selectedVillage.province !== province ||
    selectedVillage.district !== district ||
    selectedVillage.subdistrict !== subdistrict
  ) {
    return NextResponse.json(
      { error: "ข้อมูลพื้นที่ไม่ตรงกับหมู่บ้านที่เลือก" },
      { status: 400 }
    );
  }

  // Check if there's a matching person record
  const matchedPerson = await prisma.person.findFirst({
    where: {
      villageId,
      nationalId,
      phone: phoneNumber,
    },
    select: { id: true },
  });

  if (!matchedPerson) {
    return NextResponse.json(
      { error: "ไม่พบข้อมูลผู้ใหญ่บ้าน/กรรมการที่ตรงกับเลขบัตรและเบอร์โทรในทะเบียนกลาง" },
      { status: 400 }
    );
  }

  return NextResponse.json({ valid: true });
}