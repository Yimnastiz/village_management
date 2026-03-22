import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const checkRegistrationSchema = z.object({
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
  const parsed = checkRegistrationSchema.safeParse(payload);

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

  const user = await prisma.user.findFirst({
    where: {
      phoneNumber: {
        in: candidates,
      },
    },
    select: {
      id: true,
      phoneNumber: true,
    },
  });

  if (!user) {
    return NextResponse.json(
      {
        error:
          "This phone number is not registered yet. Please register before logging in or requesting binding.",
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    registered: true,
    phoneNumber: user.phoneNumber,
    userId: user.id,
  });
}
