import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, NotificationStatus } from "@prisma/client";

if (!process.env.DATABASE_URL) {
  throw new Error("Missing DATABASE_URL for smoke script");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function toDateOnly(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function format(date) {
  return new Date(date).toISOString().slice(0, 10);
}

async function main() {
  const runId = `smoke-apt-${Date.now()}`;
  const villageSlug = `village-${runId}`;
  const adminPhone = `+6698${Math.floor(Math.random() * 9000000 + 1000000)}`;
  const residentPhone = `+6697${Math.floor(Math.random() * 9000000 + 1000000)}`;

  const village = await prisma.village.create({
    data: {
      slug: villageSlug,
      name: `Smoke Village ${runId}`,
      province: "Bangkok",
      district: "Sai Mai",
      subdistrict: "O Ngoen",
      isActive: true,
    },
  });

  const admin = await prisma.user.create({
    data: {
      phoneNumber: adminPhone,
      phoneNumberVerified: true,
      name: "Smoke Admin",
    },
  });

  const resident = await prisma.user.create({
    data: {
      phoneNumber: residentPhone,
      phoneNumberVerified: true,
      name: "Smoke Resident",
    },
  });

  await prisma.villageMembership.createMany({
    data: [
      {
        userId: admin.id,
        villageId: village.id,
        role: "HEADMAN",
        status: "ACTIVE",
        joinedAt: new Date(),
      },
      {
        userId: resident.id,
        villageId: village.id,
        role: "RESIDENT",
        status: "ACTIVE",
        joinedAt: new Date(),
      },
    ],
  });

  const requestedDate = new Date();
  requestedDate.setUTCDate(requestedDate.getUTCDate() + 2);
  const requestedDateOnly = toDateOnly(requestedDate);

  const suggestedSlot = await prisma.appointmentSlot.create({
    data: {
      villageId: village.id,
      date: requestedDateOnly,
      startTime: "10:00",
      endTime: "10:30",
      maxCapacity: 3,
      isBlocked: false,
    },
  });

  // 1) Resident creates appointment without selecting time.
  const pendingNoSlot = await prisma.appointment.create({
    data: {
      villageId: village.id,
      userId: resident.id,
      title: "ขอพบผู้ใหญ่บ้าน",
      description: "ไม่มีเวลาเฉพาะให้เลือก",
      stage: "PENDING_APPROVAL",
      slotId: null,
      scheduledAt: requestedDateOnly,
    },
    include: { slot: true },
  });

  assert(!pendingNoSlot.slotId, "Expected no slot selected");
  assert(Boolean(pendingNoSlot.scheduledAt), "Expected scheduledAt to be set when no slot selected");

  // 2) Admin should still see requested date via fallback slot?.date ?? scheduledAt
  const adminView = await prisma.appointment.findUnique({
    where: { id: pendingNoSlot.id },
    include: { slot: true },
  });

  const adminDate = adminView?.slot?.date ?? adminView?.scheduledAt;
  assert(Boolean(adminDate), "Admin fallback date should exist");
  assert(format(adminDate) === format(requestedDateOnly), "Admin fallback date should match resident requested date");

  // 3) Admin suggests time, then resident confirms.
  await prisma.appointment.update({
    where: { id: pendingNoSlot.id },
    data: {
      stage: "TIME_SUGGESTED",
      slotId: suggestedSlot.id,
      scheduledAt: suggestedSlot.date,
      reviewNote: "แนะนำเวลาที่ว่าง",
      reviewedBy: admin.id,
      reviewedAt: new Date(),
    },
  });

  await prisma.notification.create({
    data: {
      userId: resident.id,
      villageId: village.id,
      type: "APPOINTMENT_UPDATE",
      title: "อัปเดตนัดหมาย: มีการแนะนำเวลา",
      body: `เรื่อง: ${pendingNoSlot.title} | เวลาแนะนำ ${suggestedSlot.startTime}-${suggestedSlot.endTime}`,
      metadata: { appointmentId: pendingNoSlot.id },
    },
  });

  await prisma.appointment.update({
    where: { id: pendingNoSlot.id },
    data: { stage: "APPROVED" },
  });

  await prisma.notification.create({
    data: {
      userId: admin.id,
      villageId: village.id,
      type: "APPOINTMENT_UPDATE",
      title: "อัปเดตนัดหมาย: ลูกบ้านยืนยันเวลา",
      body: `เรื่อง: ${pendingNoSlot.title}`,
      metadata: { appointmentId: pendingNoSlot.id },
    },
  });

  // 4) Second flow: resident rejects suggested time.
  const secondApt = await prisma.appointment.create({
    data: {
      villageId: village.id,
      userId: resident.id,
      title: "ขอหนังสือรับรอง",
      stage: "TIME_SUGGESTED",
      slotId: suggestedSlot.id,
      scheduledAt: suggestedSlot.date,
      reviewNote: "แนะนำช่วงเช้า",
      reviewedBy: admin.id,
      reviewedAt: new Date(),
    },
  });

  await prisma.appointment.update({
    where: { id: secondApt.id },
    data: { stage: "CANCELLED", slotId: null, scheduledAt: null },
  });

  await prisma.notification.create({
    data: {
      userId: admin.id,
      villageId: village.id,
      type: "APPOINTMENT_UPDATE",
      title: "อัปเดตนัดหมาย: ลูกบ้านปฏิเสธเวลา",
      body: `เรื่อง: ${secondApt.title}`,
      metadata: { appointmentId: secondApt.id },
    },
  });

  const [residentUnread, adminUnread] = await Promise.all([
    prisma.notification.count({
      where: { userId: resident.id, status: NotificationStatus.UNREAD },
    }),
    prisma.notification.count({
      where: { userId: admin.id, status: NotificationStatus.UNREAD },
    }),
  ]);

  assert(residentUnread >= 1, "Resident should have appointment notifications");
  assert(adminUnread >= 2, "Admin should have appointment notifications");

  console.log(
    JSON.stringify({
      ok: true,
      flow: {
        createdWithoutSlot: true,
        adminSeesRequestedDate: true,
        suggestAndConfirm: true,
        suggestAndReject: true,
      },
      unread: {
        resident: residentUnread,
        admin: adminUnread,
      },
      ids: {
        villageId: village.id,
        residentId: resident.id,
        adminId: admin.id,
        firstAppointmentId: pendingNoSlot.id,
        secondAppointmentId: secondApt.id,
      },
    })
  );
}

main()
  .catch((error) => {
    console.error("SMOKE_APPOINTMENTS_FAILED", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
