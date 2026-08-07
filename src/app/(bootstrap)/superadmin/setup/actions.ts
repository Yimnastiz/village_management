"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AccountStatus, AuditAction, SystemRole } from "@prisma/client";
import { z } from "zod";
import { getBootstrapSecret, isBootstrapSecretSafeForEnvironment, matchesBootstrapSecret } from "@/lib/first-superadmin";
import { prisma } from "@/lib/prisma";
import { toPhoneCandidates } from "@/lib/registration-temp";

export type FirstSuperAdminActionState = { error?: string };

const formSchema = z.object({
  firstName: z.string().trim().min(1, "กรุณากรอกชื่อ").max(100),
  lastName: z.string().trim().min(1, "กรุณากรอกนามสกุล").max(100),
  phoneNumber: z.string().regex(/^\d{10}$/, "กรุณากรอกเบอร์โทรศัพท์ 10 หลัก"),
  email: z.string().trim().email("รูปแบบอีเมลไม่ถูกต้อง").optional().or(z.literal("")),
  bootstrapSecret: z.string().min(1, "กรุณากรอกรหัสติดตั้ง"),
});

type Attempt = { failedCount: number; windowStartedAt: number; lockedUntil: number };
const attemptStore = new Map<string, Attempt>();
const MAX_FAILED_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const LOCK_DURATION_MS = 15 * 60 * 1000;

async function attemptKey(): Promise<string> {
  const requestHeaders = await headers();
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ?? requestHeaders.get("x-real-ip") ?? "unknown";
  return createHash("sha256").update(ip).digest("hex");
}

function isAttemptLocked(key: string, now: number): boolean {
  const attempt = attemptStore.get(key);
  if (!attempt) return false;
  if (attempt.lockedUntil > now) return true;
  if (now - attempt.windowStartedAt > ATTEMPT_WINDOW_MS) attemptStore.delete(key);
  return false;
}

function recordFailedAttempt(key: string, now: number): void {
  const current = attemptStore.get(key);
  const attempt = !current || now - current.windowStartedAt > ATTEMPT_WINDOW_MS
    ? { failedCount: 1, windowStartedAt: now, lockedUntil: 0 }
    : { ...current, failedCount: current.failedCount + 1 };
  if (attempt.failedCount >= MAX_FAILED_ATTEMPTS) attempt.lockedUntil = now + LOCK_DURATION_MS;
  attemptStore.set(key, attempt);
}

export async function createFirstSuperAdminAction(_previousState: FirstSuperAdminActionState, formData: FormData): Promise<FirstSuperAdminActionState> {
  const parsed = formSchema.safeParse({
    firstName: formData.get("firstName"), lastName: formData.get("lastName"), phoneNumber: formData.get("phoneNumber"),
    email: formData.get("email"), bootstrapSecret: formData.get("bootstrapSecret"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };

  const configuredSecret = getBootstrapSecret();
  if (!configuredSecret) return { error: "ระบบยังไม่ได้ตั้งค่ารหัสติดตั้ง Super Admin" };
  if (!isBootstrapSecretSafeForEnvironment(configuredSecret)) return { error: "ไม่อนุญาตให้ใช้รหัสติดตั้งค่าเริ่มต้นใน production" };

  const key = await attemptKey();
  const now = Date.now();
  if (isAttemptLocked(key, now)) return { error: "ลองรหัสผิดหลายครั้งเกินไป กรุณารอ 15 นาทีแล้วลองใหม่" };
  if (!matchesBootstrapSecret(parsed.data.bootstrapSecret)) {
    recordFailedAttempt(key, now);
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { error: "รหัสติดตั้งไม่ถูกต้อง" };
  }

  const name = `${parsed.data.firstName} ${parsed.data.lastName}`.replace(/\s+/gu, " ").trim();
  const email = parsed.data.email ? parsed.data.email.toLowerCase() : null;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('first-superadmin-bootstrap'))`;
      if (await tx.user.count({ where: { systemRole: SystemRole.SUPERADMIN } })) throw new Error("BOOTSTRAP_CLOSED");
      const duplicate = await tx.user.findFirst({ where: { OR: [{ phoneNumber: { in: toPhoneCandidates(parsed.data.phoneNumber) } }, ...(email ? [{ email }] : [])] }, select: { id: true } });
      if (duplicate) throw new Error("DUPLICATE_USER");

      const createdAt = new Date();
      const user = await tx.user.create({
        data: { name, phoneNumber: parsed.data.phoneNumber, phoneNumberVerified: true, email, emailVerified: Boolean(email), systemRole: SystemRole.SUPERADMIN, accountStatus: AccountStatus.ACTIVE, citizenVerifiedAt: createdAt, consentAt: createdAt },
        select: { id: true },
      });
      await tx.auditLog.create({ data: { userId: user.id, action: AuditAction.CREATE, resource: "FirstSuperAdminBootstrap", resourceId: user.id, metadata: { event: "FIRST_SUPERADMIN_BOOTSTRAP", bootstrap: true } } });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "BOOTSTRAP_CLOSED") return { error: "ระบบมี Super Admin แล้ว ไม่สามารถใช้หน้า setup นี้ได้อีก" };
    if (error instanceof Error && error.message === "DUPLICATE_USER") return { error: "เบอร์โทรศัพท์หรืออีเมลนี้ถูกใช้ในระบบแล้ว" };
    throw error;
  }

  attemptStore.delete(key);
  revalidatePath("/superadmin/setup");
  redirect("/auth/login?registered=success&callbackUrl=/superadmin/dashboard");
}
