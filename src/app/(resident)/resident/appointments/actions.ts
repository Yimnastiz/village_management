"use server";

import { NotificationType, Prisma, VillageMembershipRole } from "@prisma/client";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { isAdminUser } from "@/lib/access-control";
import { revalidateAdminSidebar } from "@/lib/revalidate-admin-sidebar";
import { MEMBERSHIP_ROLE_LABELS } from "@/lib/constants";
import { formatThaiDate, formatThaiShortDate } from "@/lib/utils";
import { notificationMetadata } from "@/lib/notification-copy";

const appointmentSchema = z.object({
  title: z.string().min(3, "ชื่อนัดหมายต้องมีความยาวอย่างน้อย 3 ตัวอักษร"),
  description: z.string().optional(),
  slotId: z.string().optional(),
  requestedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "กรุณาเลือกวันที่นัดหมาย"),
  targetAdminUserId: z.string().optional(),
});

const approveAppointmentSchema = z.object({
  appointmentId: z.string(),
  slotId: z.string().optional(),
  reviewNote: z.string().optional(),
});

const rejectAppointmentSchema = z.object({
  appointmentId: z.string(),
  reviewNote: z.string().trim().min(5, "กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร"),
});

const suggestTimeSchema = z.object({
  appointmentId: z.string(),
  slotId: z.string(),
  message: z.string().optional(),
});

const ADMIN_MEMBERSHIP_ROLES: VillageMembershipRole[] = [
  "HEADMAN",
  "ASSISTANT_HEADMAN",
  "COMMITTEE",
];

function formatAppointmentStart(date: Date, startTime: string): string {
  return `${formatThaiDate(date)} เวลา ${startTime}`;
}

function appointmentAdminRoleLabel(role: VillageMembershipRole | null | undefined): string {
  return role ? MEMBERSHIP_ROLE_LABELS[role] ?? "ผู้ดูแลหมู่บ้าน" : "ผู้ดูแลหมู่บ้าน";
}

function adminCreatedAppointmentNotificationCopy(
  title: string,
  date: Date,
  startTime: string,
  creatorRole: VillageMembershipRole | null | undefined
) {
  const roleLabel = appointmentAdminRoleLabel(creatorRole);
  return {
    title: "มีนัดหมายใหม่รอคุณยืนยันเวลา",
    body: `${roleLabel}ได้นัดหมาย “${title}” ${formatAppointmentStart(date, startTime)} กรุณาตรวจสอบและยืนยันเวลานัดหมาย`,
  };
}

function proposedAppointmentTimeNotificationCopy(
  title: string,
  date: Date,
  startTime: string,
  _responderRole: VillageMembershipRole | null | undefined
) {
  return {
    title: "มีเวลานัดหมายใหม่รอการยืนยัน",
    body: `มีการเสนอเวลาใหม่สำหรับ “${title}” ${formatAppointmentStart(date, startTime)} กรุณาตรวจสอบและยืนยันเวลานัดหมาย`,
  };
}

function updatedAdminCreatedAppointmentNotificationCopy(title: string, date: Date, startTime: string) {
  return {
    title: "มีเวลานัดหมายใหม่รอการยืนยัน",
    body: `มีการเสนอเวลาใหม่สำหรับ “${title}” ${formatAppointmentStart(date, startTime)} กรุณาตรวจสอบและยืนยันเวลานัดหมาย`,
  };
}

async function getVillageAdminUserIds(villageId: string): Promise<string[]> {
  const admins = await prisma.villageMembership.findMany({
    where: {
      villageId,
      status: "ACTIVE",
      role: { in: ADMIN_MEMBERSHIP_ROLES },
    },
    select: { userId: true },
  });

  return Array.from(new Set(admins.map((item) => item.userId)));
}

async function getAdminResponderSummary(villageId: string, userId: string): Promise<{ userId: string; name: string; phoneNumber: string; role: VillageMembershipRole } | null> {
  const membership = await prisma.villageMembership.findFirst({
    where: {
      villageId,
      userId,
      status: "ACTIVE",
      role: { in: ADMIN_MEMBERSHIP_ROLES },
    },
    include: {
      user: {
        select: {
          name: true,
          phoneNumber: true,
        },
      },
    },
  });

  if (!membership) {
    return null;
  }

  return {
    userId,
    name: membership.user.name,
    phoneNumber: membership.user.phoneNumber,
    role: membership.role,
  };
}

async function notifyVillageAdmins(
  villageId: string,
  title: string,
  body: string,
  metadata?: Prisma.InputJsonObject,
  excludeUserId?: string
) {
  const adminUserIds = await getVillageAdminUserIds(villageId);
  const recipients = excludeUserId
    ? adminUserIds.filter((userId) => userId !== excludeUserId)
    : adminUserIds;

  if (recipients.length === 0) return;

  await prisma.notification.createMany({
    data: recipients.map((userId) => ({
      userId,
      villageId,
      type: NotificationType.APPOINTMENT_UPDATE,
      title,
      body,
      metadata: notificationMetadata("APPOINTMENT", metadata ?? {}),
    })),
  });
}

async function notifyUser(
  userId: string,
  villageId: string,
  title: string,
  body: string,
  metadata?: Prisma.InputJsonObject
) {
  await prisma.notification.create({
    data: {
      userId,
      villageId,
      type: NotificationType.APPOINTMENT_UPDATE,
      title,
      body,
      metadata: notificationMetadata("APPOINTMENT", metadata ?? {}),
    },
  });
}

function revalidateAppointmentViews(appointmentId: string) {
  revalidateAdminSidebar();
  revalidatePath("/resident/notifications");
  revalidatePath("/admin/notifications");
  revalidatePath("/resident/appointments");
  revalidatePath("/admin/appointments");
  revalidatePath(`/resident/appointments/${appointmentId}`);
  revalidatePath(`/admin/appointments/${appointmentId}`);
  revalidatePath("/admin/appointments/calendar");
}

const simpleRequestSchema = z.object({
  title: z.string().min(3, "กรุณาระบุเรื่องที่ต้องการนัด"),
  description: z.string().optional(),
  preferredTime: z.string().max(250).optional(),
  targetAdminUserId: z.string().optional(),
});

/** Resident creates only a request. No availability or slot is exposed or accepted. */
export async function requestAppointmentAction(input: z.input<typeof simpleRequestSchema>): Promise<{ success: true; appointmentId: string } | { success: false; error: string }> {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) return { success: false, error: "กรุณาเข้าสู่ระบบ" };
  const parsed = simpleRequestSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ?? "ข้อมูลไม่ถูกต้อง" };
  const membership = getResidentMembership(session);
  if (!membership) return { success: false, error: "ไม่พบหมู่บ้านของคุณ" };

  const target = parsed.data.targetAdminUserId ? await getAdminResponderSummary(membership.villageId, parsed.data.targetAdminUserId) : null;
  if (parsed.data.targetAdminUserId && !target) return { success: false, error: "ผู้รับนัดหมายไม่ถูกต้อง" };
  const appointment = await prisma.appointment.create({ data: {
    villageId: membership.villageId, userId: session.id, title: parsed.data.title.trim(),
    description: [parsed.data.description?.trim(), parsed.data.preferredTime?.trim() ? `ช่วงเวลาที่สะดวก: ${parsed.data.preferredTime.trim()}` : null].filter(Boolean).join("\n") || null,
    stage: "PENDING_APPROVAL",
  } });
  await prisma.appointmentTimeline.create({ data: { appointmentId: appointment.id, actorId: session.id, action: "CREATED", description: "ลูกบ้านส่งคำขอนัดหมาย", metadata: { targetAdminUserId: target?.userId ?? null, targetAdminName: target?.name ?? null, targetAdminRole: target?.role ?? null, preferredTime: parsed.data.preferredTime?.trim() || null } } });
  const text = `เรื่อง: ${appointment.title}${parsed.data.preferredTime?.trim() ? ` | ช่วงที่สะดวก: ${parsed.data.preferredTime.trim()}` : ""}`;
  if (target) await notifyUser(target.userId, membership.villageId, "คำขอนัดหมายใหม่", text, { appointmentId: appointment.id });
  else await notifyVillageAdmins(membership.villageId, "คำขอนัดหมายใหม่", text, { appointmentId: appointment.id });
  revalidateAppointmentViews(appointment.id);
  return { success: true, appointmentId: appointment.id };
}

export async function updateAppointmentRequestAction(appointmentId: string, input: z.input<typeof simpleRequestSchema>): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) return { success: false, error: "กรุณาเข้าสู่ระบบ" };
  const parsed = simpleRequestSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ?? "ข้อมูลไม่ถูกต้อง" };
  const appointment = await prisma.appointment.findFirst({ where: { id: appointmentId, userId: session.id } });
  const source = appointment ? await getAppointmentCreationSource(appointment.id) : null;
  if (!appointment || source?.isAdminCreated || appointment.stage !== "PENDING_APPROVAL") return { success: false, error: "แก้ไขคำขอนัดหมายนี้ไม่ได้แล้ว" };
  const target = parsed.data.targetAdminUserId ? await getAdminResponderSummary(appointment.villageId, parsed.data.targetAdminUserId) : null;
  if (parsed.data.targetAdminUserId && !target) return { success: false, error: "ผู้รับนัดหมายไม่ถูกต้อง" };
  const firstEntry = await prisma.appointmentTimeline.findFirst({ where: { appointmentId }, orderBy: { createdAt: "asc" }, select: { metadata: true } });
  const firstMetadata = firstEntry?.metadata && typeof firstEntry.metadata === "object" && !Array.isArray(firstEntry.metadata) ? firstEntry.metadata : {};
  const previousPreferredTime = typeof firstMetadata.preferredTime === "string" ? firstMetadata.preferredTime : null;
  const nextTitle = parsed.data.title.trim();
  const nextDescription = parsed.data.description?.trim() || null;
  const nextPreferredTime = parsed.data.preferredTime?.trim() || null;
  const changes = {
    ...(nextTitle !== appointment.title ? { title: { from: appointment.title, to: nextTitle } } : {}),
    ...(nextDescription !== appointment.description ? { descriptionChanged: true } : {}),
    ...(nextPreferredTime !== previousPreferredTime ? { preferredTime: { from: previousPreferredTime, to: nextPreferredTime } } : {}),
  };
  await prisma.$transaction([
    prisma.appointment.update({ where: { id: appointment.id }, data: { title: nextTitle, description: [nextDescription, nextPreferredTime ? `ช่วงเวลาที่สะดวก: ${nextPreferredTime}` : null].filter(Boolean).join("\n") || null } }),
    prisma.appointmentTimeline.create({ data: { appointmentId, actorId: session.id, action: "UPDATED", description: "ลูกบ้านแก้ไขคำขอนัดหมาย", metadata: { targetAdminUserId: target?.userId ?? null, targetAdminName: target?.name ?? null, targetAdminRole: target?.role ?? null, preferredTime: nextPreferredTime, changes } } }),
  ]);
  revalidateAppointmentViews(appointmentId);
  return { success: true };
}

const manualSuggestionSchema = z.object({ appointmentId: z.string(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), startTime: z.string().regex(/^\d{2}:\d{2}$/), message: z.string().max(500).optional() });

/** Admin proposes a one-off time; this creates no reusable availability. */
export async function proposeAppointmentTimeAction(input: z.input<typeof manualSuggestionSchema>): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id || !isAdminUser(session)) return { success: false, error: "ไม่มีสิทธิ์ใช้งาน" };
  const parsed = manualSuggestionSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "กรุณาระบุวันและเวลาที่ถูกต้อง" };
  const appointment = await prisma.appointment.findUnique({ where: { id: parsed.data.appointmentId } });
  if (!appointment) return { success: false, error: "ไม่พบคำขอนัดหมาย" };
  const membership = await prisma.villageMembership.findFirst({ where: { userId: session.id, villageId: appointment.villageId, status: "ACTIVE", role: { in: ADMIN_MEMBERSHIP_ROLES } } });
  const source = await getAppointmentCreationSource(appointment.id);
  if (!membership || source.isAdminCreated || appointment.stage !== "PENDING_APPROVAL") return { success: false, error: "ไม่สามารถเสนอเวลาในสถานะนี้ได้" };
  const endTime = getAdminCreatedAppointmentEndTime(parsed.data.startTime);
  if (!endTime) return { success: false, error: "เวลาเริ่มต้นต้องไม่เกิน 23:00 น." };
  const date = new Date(`${parsed.data.date}T00:00:00.000Z`);
  const slot = await prisma.appointmentSlot.create({ data: { villageId: appointment.villageId, date, startTime: parsed.data.startTime, endTime, maxCapacity: 1, note: `เวลาที่เสนอสำหรับคำขอนัด ${appointment.id}` } });
  const responder = await getAdminResponderSummary(appointment.villageId, session.id);
  await prisma.$transaction([
    prisma.appointment.update({ where: { id: appointment.id }, data: { stage: "TIME_SUGGESTED", slotId: slot.id, scheduledAt: date, reviewedBy: session.id, reviewedAt: new Date(), reviewNote: parsed.data.message?.trim() || null } }),
    prisma.appointmentTimeline.create({ data: { appointmentId: appointment.id, actorId: session.id, action: "TIME_SUGGESTED", description: "ผู้ใหญ่บ้านเสนอวันเวลาให้ลูกบ้านยืนยัน", metadata: { adminMessage: parsed.data.message?.trim() || null, responderName: responder?.name ?? null, slotDate: date, slotTime: `${slot.startTime}-${slot.endTime}` } } }),
  ]);
  const notification = proposedAppointmentTimeNotificationCopy(appointment.title, date, slot.startTime, responder?.role);
  await notifyUser(appointment.userId, appointment.villageId, notification.title, notification.body, { appointmentId: appointment.id });
  revalidateAppointmentViews(appointment.id);
  return { success: true };
}

const ADMIN_CREATED_APPOINTMENT_DURATION_MINUTES = 30;

function getAdminCreatedAppointmentEndTime(startTime: string) {
  const [hours, minutes] = startTime.split(":").map(Number);
  const endMinutes = hours * 60 + minutes + ADMIN_CREATED_APPOINTMENT_DURATION_MINUTES;
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours > 23 || minutes > 59 || endMinutes >= 24 * 60) return null;
  return `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
}

/**
 * `Appointment.userId` is always the resident the appointment is with.  The
 * creation source is recorded by the first timeline item instead: resident
 * requests start with CREATED, while appointments made by an admin start with
 * TIME_SUGGESTED and `adminCreated: true`.  Treat missing/legacy metadata as a
 * resident request so it can never grant admin-content edit permission.
 */
async function getAppointmentCreationSource(appointmentId: string) {
  const firstEntry = await prisma.appointmentTimeline.findFirst({
    where: { appointmentId },
    orderBy: { createdAt: "asc" },
    select: { actorId: true, metadata: true },
  });
  const metadata = firstEntry?.metadata;
  const isAdminCreated = Boolean(
    metadata && typeof metadata === "object" && !Array.isArray(metadata) && metadata.adminCreated === true
  );

  return { isAdminCreated, creatorId: isAdminCreated ? firstEntry?.actorId ?? null : null };
}

const adminCreatedSchema = z.object({ residentUserId: z.string(), title: z.string().min(3), description: z.string().optional(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), startTime: z.string().regex(/^\d{2}:\d{2}$/) });
export async function adminCreateAppointmentAction(input: z.input<typeof adminCreatedSchema>): Promise<{ success: true; appointmentId: string } | { success: false; error: string }> {
  const session = await getSessionContextFromServerCookies(); if (!session?.id || !isAdminUser(session)) return { success: false, error: "ไม่มีสิทธิ์ใช้งาน" };
  const parsed = adminCreatedSchema.safeParse(input); if (!parsed.success) return { success: false, error: "กรอกข้อมูลนัดหมายให้ครบถ้วน" };
  const endTime = getAdminCreatedAppointmentEndTime(parsed.data.startTime); if (!endTime) return { success: false, error: "เวลาเริ่มต้นต้องไม่เกิน 23:00 น." };
  const admin = await prisma.villageMembership.findFirst({ where: { userId: session.id, status: "ACTIVE", role: { in: ADMIN_MEMBERSHIP_ROLES } } }); if (!admin) return { success: false, error: "ไม่พบหมู่บ้านที่คุณดูแล" };
  const resident = await prisma.villageMembership.findFirst({ where: { villageId: admin.villageId, userId: parsed.data.residentUserId, status: "ACTIVE", role: "RESIDENT" } }); if (!resident) return { success: false, error: "ไม่พบลูกบ้านในหมู่บ้านของคุณ" };
  const date = new Date(`${parsed.data.date}T00:00:00.000Z`); const slot = await prisma.appointmentSlot.create({ data: { villageId: admin.villageId, date, startTime: parsed.data.startTime, endTime, maxCapacity: 1, note: "นัดหมายที่ผู้ใหญ่บ้านสร้าง" } });
  const appointment = await prisma.appointment.create({ data: { villageId: admin.villageId, userId: resident.userId, title: parsed.data.title.trim(), description: parsed.data.description?.trim() || null, stage: "TIME_SUGGESTED", slotId: slot.id, scheduledAt: date, reviewedBy: session.id, reviewedAt: new Date() } });
  const creator = await getAdminResponderSummary(admin.villageId, session.id);
  await prisma.appointmentTimeline.create({ data: { appointmentId: appointment.id, actorId: session.id, action: "TIME_SUGGESTED", description: "ผู้ใหญ่บ้านสร้างนัดหมายและเสนอวันเวลา", metadata: { adminCreated: true, creatorName: creator?.name ?? null, creatorRole: creator?.role ?? null } } });
  const notification = adminCreatedAppointmentNotificationCopy(appointment.title, date, slot.startTime, creator?.role);
  await notifyUser(resident.userId, admin.villageId, notification.title, notification.body, { appointmentId: appointment.id }); revalidateAppointmentViews(appointment.id); return { success: true, appointmentId: appointment.id };
}

const adminUpdateSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("PROPOSE_TIME"), appointmentId: z.string(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), startTime: z.string().regex(/^\d{2}:\d{2}$/) }),
  z.object({ mode: z.literal("EDIT_ADMIN_CREATED"), appointmentId: z.string(), title: z.string().min(3), description: z.string().optional(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), startTime: z.string().regex(/^\d{2}:\d{2}$/) }),
]);
export async function adminUpdateAppointmentAction(input: z.input<typeof adminUpdateSchema>): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getSessionContextFromServerCookies(); if (!session?.id || !isAdminUser(session)) return { success: false, error: "ไม่มีสิทธิ์ใช้งาน" };
  const parsed = adminUpdateSchema.safeParse(input); if (!parsed.success) return { success: false, error: "ข้อมูลนัดหมายไม่ถูกต้อง" };
  const appointment = await prisma.appointment.findUnique({ where: { id: parsed.data.appointmentId } }); if (!appointment) return { success: false, error: "ไม่พบนัดหมาย" };
  const membership = await prisma.villageMembership.findFirst({ where: { userId: session.id, villageId: appointment.villageId, status: "ACTIVE", role: { in: ADMIN_MEMBERSHIP_ROLES } } }); if (!membership) return { success: false, error: "ไม่มีสิทธิ์จัดการนัดหมายนี้" };
  const source = await getAppointmentCreationSource(appointment.id);
  const endTime = getAdminCreatedAppointmentEndTime(parsed.data.startTime); if (!endTime) return { success: false, error: "เวลาเริ่มต้นต้องไม่เกิน 23:00 น." };

  if (parsed.data.mode === "PROPOSE_TIME") {
    if (source.isAdminCreated || appointment.stage !== "PENDING_APPROVAL") return { success: false, error: "นัดหมายนี้เสนอวันเวลาไม่ได้" };
  } else if (!source.isAdminCreated || source.creatorId !== session.id || appointment.stage !== "TIME_SUGGESTED") {
    return { success: false, error: "แก้ไขได้เฉพาะนัดหมายที่คุณสร้างและยังรอลูกบ้านยืนยัน" };
  }

  const isProposal = parsed.data.mode === "PROPOSE_TIME";
  const title = parsed.data.mode === "PROPOSE_TIME" ? appointment.title : parsed.data.title.trim();
  const description = parsed.data.mode === "PROPOSE_TIME" ? appointment.description : parsed.data.description?.trim() || null;
  const date = new Date(`${parsed.data.date}T00:00:00.000Z`);
  const currentSlot = appointment.slotId
    ? await prisma.appointmentSlot.findUnique({ where: { id: appointment.slotId }, select: { date: true, startTime: true } })
    : null;
  const hasMeaningfulChange = !currentSlot
    || title !== appointment.title
    || description !== appointment.description
    || currentSlot.startTime !== parsed.data.startTime
    || currentSlot.date.toISOString().slice(0, 10) !== parsed.data.date;
  if (!hasMeaningfulChange) return { success: true };

  const slot = await prisma.appointmentSlot.create({ data: { villageId: appointment.villageId, date, startTime: parsed.data.startTime, endTime, maxCapacity: 1, note: `เวลาแก้ไขสำหรับนัด ${appointment.id}` } });
  await prisma.$transaction([
    prisma.appointment.update({ where: { id: appointment.id }, data: { title, description, slotId: slot.id, scheduledAt: date, stage: "TIME_SUGGESTED", reviewedBy: session.id, reviewedAt: new Date() } }),
    prisma.appointmentTimeline.create({ data: { appointmentId: appointment.id, actorId: session.id, action: isProposal ? "TIME_SUGGESTED" : "UPDATED", description: isProposal ? "ผู้ใหญ่บ้านเสนอวันเวลาให้ลูกบ้านยืนยัน" : "ผู้ใหญ่บ้านแก้ไขนัดหมายที่ยังรอลูกบ้านยืนยัน", metadata: { slotDate: date, slotTime: slot.startTime } } }),
  ]);
  const notification = isProposal
    ? proposedAppointmentTimeNotificationCopy(title, date, slot.startTime, membership.role)
    : updatedAdminCreatedAppointmentNotificationCopy(title, date, slot.startTime);
  await notifyUser(appointment.userId, appointment.villageId, notification.title, notification.body, { appointmentId: appointment.id });
  revalidateAppointmentViews(appointment.id); return { success: true };
}

export async function createAppointmentAction(formData: FormData): Promise<{ success: true; appointmentId: string } | { success: false; error: string }> {
  "use server";
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) {
    return { success: false, error: "กรุณาเข้าสู่ระบบอีกครั้ง" };
  }

  const title = formData.get("title") as string;
  const description = (formData.get("description") as string | null) || undefined;
  const slotId = (formData.get("slotId") as string | null) || undefined;
  const requestedDate = (formData.get("requestedDate") as string | null) || "";
  const targetAdminUserId = (formData.get("targetAdminUserId") as string | null) || undefined;

  const parsed = appointmentSchema.safeParse({ title, description, slotId, requestedDate, targetAdminUserId });
  if (!parsed.success) {
    return {
      success: false,
      error: Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ?? "ข้อมูลไม่ถูกต้อง",
    };
  }

  const membership = getResidentMembership(session);

  if (!membership) {
    return { success: false, error: "ไม่พบหมู่บ้านของคุณ" };
  }

  const requestedDateObj = new Date(`${parsed.data.requestedDate}T00:00:00.000Z`);
  const nextDateObj = new Date(requestedDateObj);
  nextDateObj.setUTCDate(nextDateObj.getUTCDate() + 1);

  const selectedTargetAdmin = parsed.data.targetAdminUserId
    ? await getAdminResponderSummary(membership.villageId, parsed.data.targetAdminUserId)
    : null;

  if (parsed.data.targetAdminUserId && !selectedTargetAdmin) {
    return { success: false, error: "ผู้ที่เลือกนัดหมายไม่ถูกต้อง" };
  }

  // Check whether the selected date has any available slots.
  const slotsOnDate = await prisma.appointmentSlot.findMany({
    where: {
      villageId: membership.villageId,
      date: { gte: requestedDateObj, lt: nextDateObj },
    },
    include: {
      _count: {
        select: {
          appointments: {
            where: { stage: { notIn: ["CANCELLED", "REJECTED"] } },
          },
        },
      },
    },
  });

  const hasAvailableSlot = slotsOnDate.some(
    (s) => !s.isBlocked && s._count.appointments < s.maxCapacity
  );

  if (!hasAvailableSlot) {
    return { success: false, error: "วันที่ที่เลือกผู้ใหญ่บ้านไม่ว่าง กรุณาเลือกวันอื่น" };
  }

  // If slot is selected, verify it belongs to the village, same date, and still available.
  if (slotId) {
    const slot = await prisma.appointmentSlot.findUnique({
      where: { id: slotId },
      include: {
        _count: {
          select: {
            appointments: {
              where: { stage: { notIn: ["CANCELLED", "REJECTED"] } },
            },
          },
        },
      },
    });

    if (!slot || slot.villageId !== membership.villageId) {
      return { success: false, error: "เวลาที่เลือกไม่ถูกต้อง" };
    }

    const slotDate = slot.date.toISOString().slice(0, 10);
    if (slotDate !== parsed.data.requestedDate) {
      return { success: false, error: "ช่วงเวลาที่เลือกไม่ตรงกับวันที่ที่เลือก" };
    }

    if (slot.isBlocked || slot._count.appointments >= slot.maxCapacity) {
      return { success: false, error: "ช่วงเวลานี้ไม่ว่างแล้ว กรุณาเลือกช่วงเวลาอื่น" };
    }
  }

  const appointment = await prisma.appointment.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      slotId: parsed.data.slotId,
      userId: session.id,
      villageId: membership.villageId,
      stage: "PENDING_APPROVAL",
      scheduledAt: requestedDateObj,
    },
  });

  await prisma.appointmentTimeline.create({
    data: {
      appointmentId: appointment.id,
      actorId: session.id,
      action: "CREATED",
      description: "ลูกบ้านขอจองนัดหมาย",
      metadata: {
        targetAdminUserId: selectedTargetAdmin?.userId ?? null,
        targetAdminName: selectedTargetAdmin?.name ?? null,
        targetAdminPhone: selectedTargetAdmin?.phoneNumber ?? null,
        targetAdminRole: selectedTargetAdmin?.role ?? null,
      },
    },
  });

  if (selectedTargetAdmin) {
    await notifyUser(
      selectedTargetAdmin.userId,
      membership.villageId,
      "อัปเดตนัดหมาย: คำขอใหม่ที่ระบุผู้รับนัด",
      `เรื่อง: ${parsed.data.title} | วันที่ที่ต้องการ: ${formatThaiShortDate(requestedDateObj)} | ผู้ใช้นัดกับ ${selectedTargetAdmin.name}`,
      {
        appointmentId: appointment.id,
        requestedDate: parsed.data.requestedDate,
        requestedSlotId: parsed.data.slotId ?? null,
        targetAdminUserId: selectedTargetAdmin.userId,
      }
    );
  } else {
    await notifyVillageAdmins(
      membership.villageId,
      "อัปเดตนัดหมาย: คำขอใหม่",
      `เรื่อง: ${parsed.data.title} | วันที่ที่ต้องการ: ${formatThaiShortDate(requestedDateObj)}${parsed.data.slotId ? " | ผู้ใช้เลือกช่วงเวลาแล้ว" : " | รอผู้บริหารกำหนดช่วงเวลา"}`,
      {
        appointmentId: appointment.id,
        requestedDate: parsed.data.requestedDate,
        requestedSlotId: parsed.data.slotId ?? null,
      }
    );
  }

  revalidateAppointmentViews(appointment.id);

  return { success: true, appointmentId: appointment.id };
}

export async function approveAppointmentAction(
  formData: FormData
): Promise<{ success: true } | { success: false; error: string }> {
  "use server";
  const session = await getSessionContextFromServerCookies();
  if (!session?.id || !isAdminUser(session)) {
    return { success: false, error: "ไม่มีสิทธิ์ใช้งาน" };
  }

  const appointmentId = formData.get("appointmentId") as string;
  const slotId = (formData.get("slotId") as string) || undefined;
  const reviewNote = formData.get("reviewNote") as string;

  const parsed = approveAppointmentSchema.safeParse({ appointmentId, slotId, reviewNote });
  if (!parsed.success) {
    return { success: false, error: "ข้อมูลไม่ถูกต้อง" };
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: parsed.data.appointmentId },
  });

  if (!appointment) {
    return { success: false, error: "ไม่พบนัดหมาย" };
  }

  const adminMembership = await prisma.villageMembership.findFirst({
    where: {
      userId: session.id,
      villageId: appointment.villageId,
      role: { in: ["HEADMAN", "ASSISTANT_HEADMAN", "COMMITTEE"] },
      status: "ACTIVE",
    },
  });

  if (!adminMembership) {
    return { success: false, error: "ไม่มีสิทธิ์อนุมัตินัดหมายนี้" };
  }

  const responder = await getAdminResponderSummary(appointment.villageId, session.id);

  const effectiveSlotId = parsed.data.slotId ?? appointment.slotId ?? undefined;
  if (!effectiveSlotId) {
    return { success: false, error: "ไม่พบช่วงเวลาสำหรับการอนุมัติ" };
  }

  const slot = await prisma.appointmentSlot.findUnique({
    where: { id: effectiveSlotId },
    include: {
      _count: {
        select: {
          appointments: {
            where: {
              stage: { notIn: ["CANCELLED", "REJECTED"] },
              id: { not: appointment.id },
            },
          },
        },
      },
    },
  });

  if (!slot || slot.villageId !== appointment.villageId) {
    return { success: false, error: "ช่วงเวลาที่เลือกไม่ถูกต้อง" };
  }

  if (slot.isBlocked || slot._count.appointments >= slot.maxCapacity) {
    return { success: false, error: "ช่วงเวลานี้ไม่ว่างแล้ว" };
  }

  await prisma.appointment.update({
    where: { id: appointment.id },
    data: {
      stage: "APPROVED",
      slotId: effectiveSlotId,
      scheduledAt: slot.date,
      reviewedBy: session.id,
      reviewedAt: new Date(),
      reviewNote: parsed.data.reviewNote || null,
    },
  });

  await prisma.appointmentTimeline.create({
    data: {
      appointmentId: appointment.id,
      actorId: session.id,
      action: "APPROVED",
      description: `ผู้บริหารอนุมัตินัดหมาย${parsed.data.reviewNote ? ` - ${parsed.data.reviewNote}` : ""}`,
      metadata: {
        responderName: responder?.name ?? null,
        responderPhone: responder?.phoneNumber ?? null,
        responderRole: responder?.role ?? null,
      },
    },
  });

  await notifyUser(
    appointment.userId,
    appointment.villageId,
    "ยืนยันนัดหมายแล้ว",
    `นัดหมาย “${appointment.title}” วันที่ ${formatThaiShortDate(slot.date)} เวลา ${slot.startTime}-${slot.endTime} ได้รับการยืนยันแล้ว${responder ? ` โดย ${responder.name}` : ""}`,
    {
      appointmentId: appointment.id,
      responderName: responder?.name ?? null,
      responderPhone: responder?.phoneNumber ?? null,
      responderRole: responder?.role ?? null,
    }
  );

  revalidateAppointmentViews(appointment.id);

  return { success: true };
}

export async function rejectAppointmentAction(
  formData: FormData
): Promise<{ success: true } | { success: false; error: string }> {
  "use server";
  const session = await getSessionContextFromServerCookies();
  if (!session?.id || !isAdminUser(session)) {
    return { success: false, error: "ไม่มีสิทธิ์ใช้งาน" };
  }

  const appointmentId = formData.get("appointmentId") as string;
  const reviewNote = formData.get("reviewNote") as string;

  const parsed = rejectAppointmentSchema.safeParse({ appointmentId, reviewNote });
  if (!parsed.success) {
    return {
      success: false,
      error: Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] ?? "ข้อมูลไม่ถูกต้อง",
    };
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: parsed.data.appointmentId },
  });

  if (!appointment) {
    return { success: false, error: "ไม่พบนัดหมาย" };
  }

  const adminMembership = await prisma.villageMembership.findFirst({
    where: {
      userId: session.id,
      villageId: appointment.villageId,
      role: { in: ["HEADMAN", "ASSISTANT_HEADMAN", "COMMITTEE"] },
      status: "ACTIVE",
    },
  });

  if (!adminMembership) {
    return { success: false, error: "ไม่มีสิทธิ์ปฏิเสธนัดหมายนี้" };
  }

  const source = await getAppointmentCreationSource(appointment.id);
  if (source.isAdminCreated || appointment.stage !== "PENDING_APPROVAL") {
    return { success: false, error: "ปฏิเสธได้เฉพาะคำขอนัดหมายของลูกบ้านที่รอการพิจารณา" };
  }

  const responder = await getAdminResponderSummary(appointment.villageId, session.id);

  await prisma.appointment.update({
    where: { id: appointment.id },
    data: {
      stage: "REJECTED",
      reviewedBy: session.id,
      reviewedAt: new Date(),
      reviewNote: parsed.data.reviewNote,
    },
  });

  await prisma.appointmentTimeline.create({
    data: {
      appointmentId: appointment.id,
      actorId: session.id,
      action: "REJECTED",
      description: `ปฏิเสธคำขอนัดหมาย | เหตุผล: ${parsed.data.reviewNote}`,
      metadata: {
        reason: parsed.data.reviewNote,
        responderName: responder?.name ?? null,
        responderPhone: responder?.phoneNumber ?? null,
        responderRole: responder?.role ?? null,
      },
    },
  });

  await notifyUser(
    appointment.userId,
    appointment.villageId,
    "นัดหมายไม่ได้รับการยืนยัน",
    `นัดหมาย “${appointment.title}” ไม่ได้รับการยืนยัน เหตุผล: ${parsed.data.reviewNote}${responder ? ` โดย ${responder.name}` : ""}`,
    {
      appointmentId: appointment.id,
      responderName: responder?.name ?? null,
      responderPhone: responder?.phoneNumber ?? null,
      responderRole: responder?.role ?? null,
    }
  );

  revalidateAppointmentViews(appointment.id);

  return { success: true };
}

export async function suggestTimeAction(
  formData: FormData
): Promise<{ success: true } | { success: false; error: string }> {
  "use server";
  const session = await getSessionContextFromServerCookies();
  if (!session?.id || !isAdminUser(session)) {
    return { success: false, error: "ไม่มีสิทธิ์ใช้งาน" };
  }

  const appointmentId = formData.get("appointmentId") as string;
  const slotId = formData.get("slotId") as string;
  const message = formData.get("message") as string;

  const parsed = suggestTimeSchema.safeParse({ appointmentId, slotId, message });
  if (!parsed.success) {
    return { success: false, error: "ข้อมูลไม่ถูกต้อง" };
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: parsed.data.appointmentId },
  });

  if (!appointment) {
    return { success: false, error: "ไม่พบนัดหมาย" };
  }

  const adminMembership = await prisma.villageMembership.findFirst({
    where: {
      userId: session.id,
      villageId: appointment.villageId,
      role: { in: ["HEADMAN", "ASSISTANT_HEADMAN", "COMMITTEE"] },
      status: "ACTIVE",
    },
  });

  if (!adminMembership) {
    return { success: false, error: "ไม่มีสิทธิ์แนะนำเวลาสำหรับนัดหมายนี้" };
  }

  const source = await getAppointmentCreationSource(appointment.id);
  if (source.isAdminCreated || appointment.stage !== "PENDING_APPROVAL") {
    return { success: false, error: "ไม่สามารถเสนอเวลาในสถานะนี้ได้" };
  }

  const responder = await getAdminResponderSummary(appointment.villageId, session.id);

  const slot = await prisma.appointmentSlot.findUnique({
    where: { id: parsed.data.slotId },
    include: {
      _count: {
        select: {
          appointments: {
            where: { stage: { notIn: ["CANCELLED", "REJECTED"] } },
          },
        },
      },
    },
  });

  if (!slot || slot.villageId !== appointment.villageId) {
    return { success: false, error: "เวลาที่แนะนำไม่ถูกต้อง" };
  }

  if (slot.isBlocked || slot._count.appointments >= slot.maxCapacity) {
    return { success: false, error: "ช่วงเวลานี้ไม่ว่างแล้ว" };
  }

  await prisma.appointmentTimeline.create({
    data: {
      appointmentId: appointment.id,
      actorId: session.id,
      action: "TIME_SUGGESTED",
      description: `ผู้บริหารแนะนำเวลาใหม่${parsed.data.message ? ` - ${parsed.data.message}` : ""}`,
      metadata: {
        suggestedSlotId: parsed.data.slotId,
        slotDate: slot.date,
        slotTime: `${slot.startTime}-${slot.endTime}`,
        adminMessage: parsed.data.message || null,
        responderName: responder?.name ?? null,
        responderPhone: responder?.phoneNumber ?? null,
        responderRole: responder?.role ?? null,
      },
    },
  });

  // Update appointment: set slotId and change stage to TIME_SUGGESTED
  await prisma.appointment.update({
    where: { id: appointment.id },
    data: {
      stage: "TIME_SUGGESTED",
      slotId: parsed.data.slotId,
      scheduledAt: slot.date,
      reviewedBy: session.id,
      reviewedAt: new Date(),
      reviewNote: parsed.data.message || null,
    },
  });

  // Notify the resident
  await notifyUser(
    appointment.userId,
    appointment.villageId,
    "มีเวลานัดหมายใหม่รอการยืนยัน",
    `มีการเสนอเวลาใหม่สำหรับ “${appointment.title}” วันที่ ${formatThaiShortDate(slot.date)} เวลา ${slot.startTime}-${slot.endTime} กรุณาตรวจสอบและยืนยันเวลานัดหมาย${responder ? ` โดย ${responder.name}` : ""}`,
    {
      appointmentId: appointment.id,
      responderName: responder?.name ?? null,
      responderPhone: responder?.phoneNumber ?? null,
      responderRole: responder?.role ?? null,
    }
  );

  revalidateAppointmentViews(appointment.id);

  return { success: true };
}

export async function confirmSuggestionAction(
  appointmentId: string
): Promise<{ success: true } | { success: false; error: string }> {
  "use server";
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) return { success: false, error: "กรุณาเข้าสู่ระบบ" };

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { slot: true },
  });

  if (!appointment || appointment.userId !== session.id) {
    return { success: false, error: "ไม่พบนัดหมาย" };
  }

  if (appointment.stage !== "TIME_SUGGESTED") {
    return { success: false, error: "นัดหมายนี้ไม่ได้อยู่ในสถานะรอยืนยันเวลา" };
  }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { stage: "APPROVED" },
  });

  await prisma.appointmentTimeline.create({
    data: {
      appointmentId,
      actorId: session.id,
      action: "APPROVED",
      description: "ลูกบ้านยืนยันเวลาที่ผู้บริหารแนะนำ",
    },
  });

  await notifyVillageAdmins(
    appointment.villageId,
    "อัปเดตนัดหมาย: ลูกบ้านยืนยันเวลา",
    `เรื่อง: ${appointment.title} | ลูกบ้านยืนยันเวลาที่แนะนำแล้ว`,
    { appointmentId },
    session.id
  );

  revalidateAppointmentViews(appointmentId);

  return { success: true };
}

export async function rejectSuggestionAction(
  appointmentId: string, reason: string
): Promise<{ success: true } | { success: false; error: string }> {
  "use server";
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) return { success: false, error: "กรุณาเข้าสู่ระบบ" };

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
  });

  if (!appointment || appointment.userId !== session.id) {
    return { success: false, error: "ไม่พบนัดหมาย" };
  }
  const cleanedReason = reason.trim();
  if (cleanedReason.length < 10 || cleanedReason.length > 500) return { success: false, error: "กรุณาระบุเหตุผล 10–500 ตัวอักษร" };

  if (appointment.stage !== "TIME_SUGGESTED") {
    return { success: false, error: "นัดหมายนี้ไม่ได้อยู่ในสถานะรอยืนยันเวลา" };
  }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { stage: "PENDING_APPROVAL", slotId: null, scheduledAt: null, reviewNote: cleanedReason },
  });

  await prisma.appointmentTimeline.create({
    data: {
      appointmentId,
      actorId: session.id,
      action: "TIME_CHANGE_REQUESTED",
      description: "ลูกบ้านขอเปลี่ยนเวลานัดหมาย",
      metadata: { preferredTime: cleanedReason },
    },
  });

  await notifyVillageAdmins(
    appointment.villageId,
    "อัปเดตนัดหมาย: ลูกบ้านปฏิเสธเวลา",
    `เรื่อง: ${appointment.title} | ลูกบ้านปฏิเสธเวลาที่แนะนำ`,
    { appointmentId },
    session.id
  );

  revalidateAppointmentViews(appointmentId);

  return { success: true };
}

export async function adminCancelAppointmentAction(
  formData: FormData
): Promise<{ success: true } | { success: false; error: string }> {
  "use server";
  const session = await getSessionContextFromServerCookies();
  if (!session?.id || !isAdminUser(session)) {
    return { success: false, error: "ไม่มีสิทธิ์ใช้งาน" };
  }

  const appointmentId = formData.get("appointmentId") as string;
  const reason = (formData.get("reason") as string) || "";

  if (!appointmentId) return { success: false, error: "ข้อมูลไม่ถูกต้อง" };
  if (reason.trim().length < 5 || reason.trim().length > 500) return { success: false, error: "กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร" };

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
  });

  if (!appointment) return { success: false, error: "ไม่พบนัดหมาย" };

  const adminMembership = await prisma.villageMembership.findFirst({
    where: {
      userId: session.id,
      villageId: appointment.villageId,
      role: { in: ["HEADMAN", "ASSISTANT_HEADMAN", "COMMITTEE"] },
      status: "ACTIVE",
    },
  });

  if (!adminMembership) return { success: false, error: "ไม่มีสิทธิ์ยกเลิกนัดหมายนี้" };

  const cancellableStages = new Set(["TIME_SUGGESTED", "APPROVED"]);
  if (!cancellableStages.has(appointment.stage)) {
    return { success: false, error: "ไม่สามารถยกเลิกนัดหมายในสถานะนี้ได้" };
  }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { stage: "CANCELLED", reviewNote: reason.trim(), reviewedBy: session.id, reviewedAt: new Date() },
  });

  await prisma.appointmentTimeline.create({
    data: {
      appointmentId,
      actorId: session.id,
      action: "CANCELLED",
      description: `ยกเลิกนัดหมาย | เหตุผล: ${reason.trim()}`,
      metadata: { reason: reason.trim() },
    },
  });

  // Notify resident
  await notifyUser(
    appointment.userId,
    appointment.villageId,
    "นัดหมายถูกยกเลิก",
    `นัดหมาย “${appointment.title}” ถูกยกเลิก เหตุผล: ${reason.trim()}`,
    { appointmentId }
  );

  revalidateAppointmentViews(appointmentId);

  return { success: true };
}

export async function adminEditAppointmentAction(
  formData: FormData
): Promise<{ success: true } | { success: false; error: string }> {
  "use server";
  const session = await getSessionContextFromServerCookies();
  if (!session?.id || !isAdminUser(session)) {
    return { success: false, error: "ไม่มีสิทธิ์ใช้งาน" };
  }

  const appointmentId = formData.get("appointmentId") as string;
  const newTitle = (formData.get("title") as string)?.trim();
  const newDescription = (formData.get("description") as string)?.trim() || undefined;
  const newSlotId = (formData.get("slotId") as string) || undefined;

  if (!appointmentId || !newTitle || newTitle.length < 3) {
    return { success: false, error: "ชื่อนัดหมายต้องมีความยาวอย่างน้อย 3 ตัวอักษร" };
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
  });

  if (!appointment) return { success: false, error: "ไม่พบนัดหมาย" };

  const adminMembership = await prisma.villageMembership.findFirst({
    where: {
      userId: session.id,
      villageId: appointment.villageId,
      role: { in: ["HEADMAN", "ASSISTANT_HEADMAN", "COMMITTEE"] },
      status: "ACTIVE",
    },
  });

  if (!adminMembership) return { success: false, error: "ไม่มีสิทธิ์แก้ไขนัดหมายนี้" };

  const source = await getAppointmentCreationSource(appointment.id);
  if (!source.isAdminCreated || source.creatorId !== session.id || appointment.stage !== "TIME_SUGGESTED") {
    return { success: false, error: "แก้ไขได้เฉพาะนัดหมายที่คุณสร้างและยังรอลูกบ้านยืนยัน" };
  }

  let slotDate: Date | undefined;
  if (newSlotId) {
    const slot = await prisma.appointmentSlot.findUnique({
      where: { id: newSlotId },
      include: {
        _count: {
          select: {
            appointments: {
              where: {
                stage: { notIn: ["CANCELLED", "REJECTED"] },
                id: { not: appointmentId },
              },
            },
          },
        },
      },
    });
    if (!slot || slot.villageId !== appointment.villageId) {
      return { success: false, error: "ช่วงเวลาที่เลือกไม่ถูกต้อง" };
    }
    if (slot.isBlocked || slot._count.appointments >= slot.maxCapacity) {
      return { success: false, error: "ช่วงเวลานี้ไม่ว่างแล้ว" };
    }
    slotDate = slot.date;
  }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      title: newTitle,
      description: newDescription,
      ...(newSlotId ? { slotId: newSlotId, scheduledAt: slotDate } : {}),
    },
  });

  await prisma.appointmentTimeline.create({
    data: {
      appointmentId,
      actorId: session.id,
      action: "UPDATED",
      description: `ผู้บริหารแก้ไขข้อมูลนัดหมาย`,
    },
  });

  await notifyUser(
    appointment.userId,
    appointment.villageId,
    "นัดหมายได้รับการแก้ไข",
    `นัดหมาย “${newTitle}” ได้รับการแก้ไข กรุณาตรวจสอบรายละเอียดนัดหมาย`,
    { appointmentId }
  );

  revalidateAppointmentViews(appointmentId);

  return { success: true };
}

export async function cancelAppointmentAction(
  appointmentId: string,
  reason: string
): Promise<{ success: true } | { success: false; error: string }> {
  "use server";
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) {
    return { success: false, error: "กรุณาเข้าสู่ระบบอีกครั้ง" };
  }

  const cleanedReason = reason.trim();
  if (cleanedReason.length < 5) {
    return { success: false, error: "กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร" };
  }

  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      return { success: false, error: "ไม่พบนัดหมาย" };
    }

    // Resident can only cancel their own appointment.
    if (appointment.userId !== session.id) {
      return { success: false, error: "ไม่มีสิทธิ์ยกเลิกนัดหมายนี้" };
    }

    const cancellableStages = ["PENDING_APPROVAL", "TIME_SUGGESTED", "APPROVED"] as const;
    if (!cancellableStages.includes(appointment.stage as (typeof cancellableStages)[number])) {
      return { success: false, error: "ไม่สามารถยกเลิกนัดหมายในสถานะนี้ได้" };
    }

    await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        stage: "CANCELLED",
      },
    });

    await prisma.appointmentTimeline.create({
      data: {
        appointmentId,
        actorId: session.id,
        action: "CANCELLED",
        description: "ลูกบ้านยกเลิกนัดหมาย",
        metadata: { reason: cleanedReason },
      },
    });

    await notifyVillageAdmins(
      appointment.villageId,
      "อัปเดตนัดหมาย: ลูกบ้านยกเลิก",
      `เรื่อง: ${appointment.title} | เหตุผลจากลูกบ้าน: ${cleanedReason}`,
      { appointmentId },
      session.id
    );

    revalidateAppointmentViews(appointmentId);

    return { success: true };
  } catch (error) {
    console.error("Error cancelling appointment:", error);
    return { success: false, error: "ไม่สามารถยกเลิกนัดหมายได้" };
  }
}
