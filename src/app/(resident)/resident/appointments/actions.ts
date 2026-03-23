"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { isAdminUser } from "@/lib/access-control";

const appointmentSchema = z.object({
  title: z.string().min(3, "ชื่อนัดหมายต้องมีความยาวอย่างน้อย 3 ตัวอักษร"),
  description: z.string().optional(),
  slotId: z.string().optional(),
  requestedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "กรุณาเลือกวันที่นัดหมาย"),
});

const approveAppointmentSchema = z.object({
  appointmentId: z.string(),
  slotId: z.string().optional(),
  reviewNote: z.string().optional(),
});

const rejectAppointmentSchema = z.object({
  appointmentId: z.string(),
  reviewNote: z.string().min(5, "หมายเหตุการปฏิเสธต้องมีความยาวอย่างน้อย 5 ตัวอักษร"),
});

const suggestTimeSchema = z.object({
  appointmentId: z.string(),
  slotId: z.string(),
  message: z.string().optional(),
});

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

  const parsed = appointmentSchema.safeParse({ title, description, slotId, requestedDate });
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
    },
  });

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
    },
  });

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
      description: `ผู้บริหารปฏิเสธนัดหมาย - ${parsed.data.reviewNote}`,
    },
  });

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
  await prisma.notification.create({
    data: {
      userId: appointment.userId,
      villageId: appointment.villageId,
      type: "APPOINTMENT_UPDATE",
      title: "ผู้บริหารแนะนำเวลานัดหมาย",
      body: `ผู้บริหารแนะนำเวลา ${slot.startTime}-${slot.endTime} น. วันที่ ${slot.date.toLocaleDateString("th-TH")} กรุณายืนยันหรือปฏิเสธ`,
      metadata: { appointmentId: appointment.id },
    },
  });

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

  // Notify the admin who suggested the time
  const suggestionEntry = await prisma.appointmentTimeline.findFirst({
    where: { appointmentId, action: "TIME_SUGGESTED" },
    orderBy: { createdAt: "desc" },
  });
  if (suggestionEntry?.actorId) {
    await prisma.notification.create({
      data: {
        userId: suggestionEntry.actorId,
        villageId: appointment.villageId,
        type: "APPOINTMENT_UPDATE",
        title: "ลูกบ้านยืนยันนัดหมาย",
        body: `ลูกบ้านยืนยันเวลานัดหมาย "${appointment.title}" แล้ว`,
        metadata: { appointmentId },
      },
    });
  }

  return { success: true };
}

export async function rejectSuggestionAction(
  appointmentId: string
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

  if (appointment.stage !== "TIME_SUGGESTED") {
    return { success: false, error: "นัดหมายนี้ไม่ได้อยู่ในสถานะรอยืนยันเวลา" };
  }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { stage: "CANCELLED", slotId: null, scheduledAt: null },
  });

  await prisma.appointmentTimeline.create({
    data: {
      appointmentId,
      actorId: session.id,
      action: "CANCELLED",
      description: "ลูกบ้านปฏิเสธเวลาที่ผู้บริหารแนะนำ",
    },
  });

  // Notify the admin who suggested
  const suggestionEntry = await prisma.appointmentTimeline.findFirst({
    where: { appointmentId, action: "TIME_SUGGESTED" },
    orderBy: { createdAt: "desc" },
  });
  if (suggestionEntry?.actorId) {
    await prisma.notification.create({
      data: {
        userId: suggestionEntry.actorId,
        villageId: appointment.villageId,
        type: "APPOINTMENT_UPDATE",
        title: "ลูกบ้านปฏิเสธเวลาที่แนะนำ",
        body: `ลูกบ้านปฏิเสธเวลาที่แนะนำสำหรับนัดหมาย "${appointment.title}" แล้ว`,
        metadata: { appointmentId },
      },
    });
  }

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

  const cancellableStages = ["PENDING_APPROVAL", "TIME_SUGGESTED", "APPROVED"] as const;
  if (!cancellableStages.includes(appointment.stage as any)) {
    return { success: false, error: "ไม่สามารถยกเลิกนัดหมายในสถานะนี้ได้" };
  }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { stage: "CANCELLED" },
  });

  await prisma.appointmentTimeline.create({
    data: {
      appointmentId,
      actorId: session.id,
      action: "CANCELLED",
      description: `ผู้บริหารยกเลิกนัดหมาย${reason ? ` - ${reason}` : ""}`,
    },
  });

  // Notify resident
  await prisma.notification.create({
    data: {
      userId: appointment.userId,
      villageId: appointment.villageId,
      type: "APPOINTMENT_UPDATE",
      title: "นัดหมายถูกยกเลิก",
      body: `ผู้บริหารยกเลิกนัดหมาย "${appointment.title}" ของคุณ${reason ? ` เหตุผล: ${reason}` : ""}`,
      metadata: { appointmentId },
    },
  });

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

  const editableStages = ["PENDING_APPROVAL", "TIME_SUGGESTED", "APPROVED"] as const;
  if (!editableStages.includes(appointment.stage as any)) {
    return { success: false, error: "ไม่สามารถแก้ไขนัดหมายในสถานะนี้ได้" };
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

  // Notify resident if slot changed
  if (newSlotId && newSlotId !== appointment.slotId) {
    await prisma.notification.create({
      data: {
        userId: appointment.userId,
        villageId: appointment.villageId,
        type: "APPOINTMENT_UPDATE",
        title: "ข้อมูลนัดหมายถูกแก้ไข",
        body: `ผู้บริหารแก้ไขข้อมูลนัดหมาย "${newTitle}" ของคุณ`,
        metadata: { appointmentId },
      },
    });
  }

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
        description: `ลูกบ้านยกเลิกนัดหมาย - ${cleanedReason}`,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Error cancelling appointment:", error);
    return { success: false, error: "ไม่สามารถยกเลิกนัดหมายได้" };
  }
}
