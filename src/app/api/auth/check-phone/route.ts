import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const checkPhoneSchema = z.object({
  phoneNumber: z.string().trim().min(1),
});

function normalizePhone10(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 10);
}

function toPhoneCandidates(raw: string): string[] {
  const normalized = normalizePhone10(raw);
  if (!/^\d{10}$/.test(normalized)) {
    return [];
  }

  const candidates = new Set<string>([normalized]);
  if (normalized.startsWith("0")) {
    candidates.add(`+66${normalized.slice(1)}`);
  }
  return Array.from(candidates);
}

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  const parsed = checkPhoneSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const candidates = toPhoneCandidates(parsed.data.phoneNumber);
  if (candidates.length === 0) {
    return NextResponse.json(
      { error: "Phone number must be exactly 10 digits." },
      { status: 400 }
    );
  }

  const existingUser = await prisma.user.findFirst({
    where: { phoneNumber: { in: candidates } },
    select: { id: true, phoneNumber: true },
  });

  if (existingUser) {
    return NextResponse.json(
      { error: "หมายเลขนี้ถูกใช้งานแล้ว กรุณาเข้าสู่ระบบหรือใช้เบอร์อื่น" },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true });
}
