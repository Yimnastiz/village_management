import { AccountStatus, AuditAction } from "@prisma/client";
import { redirect } from "next/navigation";
import { getDuplicateNoticeSessionFromServerCookies } from "@/lib/access-control";
import { DUPLICATE_NATIONAL_ID_REASON } from "@/lib/identity";
import { prisma } from "@/lib/prisma";
import { DuplicateAccountActions } from "./duplicate-account-actions";

export default async function DuplicateAccountNoticePage() {
  const session = await getDuplicateNoticeSessionFromServerCookies();
  if (!session) {
    redirect("/auth/login");
  }

  const now = new Date();
  const contact = await prisma.user.findUnique({
    where: { id: session.id },
    select: { registrationVillage: { select: { name: true, phone: true } } },
  });
  await prisma.$transaction(async (tx) => {
    const marked = await tx.user.updateMany({
      where: {
        id: session.id,
        accountStatus: AccountStatus.DUPLICATE_ID,
        duplicateNoticeSeenAt: null,
      },
      data: { duplicateNoticeSeenAt: now },
    });
    if (marked.count) {
      await tx.auditLog.create({
        data: {
          userId: session.id,
          action: AuditAction.VIEW_SENSITIVE,
          resource: "DuplicateNationalIdNotice",
          resourceId: session.id,
          metadata: { event: "DUPLICATE_NATIONAL_ID_NOTICE_SEEN" },
        },
      });
    }
    await tx.authSession.deleteMany({ where: { userId: session.id } });
  });

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-10 sm:py-16">
      <section className="rounded-2xl border border-red-200 bg-white p-5 shadow-xl shadow-red-950/5 sm:p-8">
        <p className="text-sm font-semibold text-red-700">ไม่สามารถใช้งานบัญชีนี้ได้</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
          เลขบัตรประชาชนนี้ถูกใช้กับบัญชีที่ผูกบ้านแล้ว
        </h1>
        <div className="mt-5 space-y-4 text-sm leading-6 text-slate-700">
          <p>
            หากคิดว่าเลขบัตรประชาชนของท่านถูกผู้อื่นนำไปใช้ กรุณาติดต่อผู้ใหญ่บ้านหรือเจ้าหน้าที่หมู่บ้าน
            {contact?.registrationVillage?.name ? ` ${contact.registrationVillage.name}` : "ของท่าน"}
            {contact?.registrationVillage?.phone ? ` โทร. ${contact.registrationVillage.phone}` : " เพื่อให้ผู้ใหญ่บ้านประสานงานกับ Superadmin ต่อไป"}
          </p>
          <p>เมื่อเจ้าหน้าที่แก้ไขข้อมูลแล้ว ท่านจึงจะสมัครใหม่ได้</p>
          <p>
            เพื่อความถูกต้องของข้อมูลทะเบียนลูกบ้าน บัญชีนี้ไม่สามารถใช้งานต่อได้
            กรุณาสมัครใหม่ด้วยข้อมูลที่ถูกต้อง
          </p>
          <p>
            หากท่านคิดว่าเป็นความผิดพลาด กรุณาแจ้งผู้ใหญ่บ้านของหมู่บ้านที่ท่านลงทะเบียนไว้
            เพื่อให้ผู้ใหญ่บ้านประสานงานกับ Super Admin
          </p>
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 font-medium text-emerald-900">
            เบอร์โทรศัพท์ของคุณถูกปล่อยให้สมัครบัญชีใหม่ได้แล้ว
          </p>
        </div>
        <p className="sr-only">{DUPLICATE_NATIONAL_ID_REASON}</p>
        <DuplicateAccountActions />
      </section>
    </main>
  );
}
