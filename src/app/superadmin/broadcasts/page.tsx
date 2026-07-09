import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";
import { BroadcastForm } from "./broadcast-form";

export default async function SuperAdminBroadcastsPage() {
  await requireSuperAdminPageSession();

  const [recentSystemNotifications, recentEmergencyBroadcasts] = await Promise.all([
    prisma.notification.findMany({
      where: {
        type: "SYSTEM",
        metadata: {
          path: ["source"],
          equals: "SUPERADMIN_BROADCAST",
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      distinct: ["title", "body"],
    }),
    prisma.emergencyBroadcast.findMany({
      where: {
        status: "ACTIVE",
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        village: {
          select: { name: true },
        },
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">ประกาศไปทุกหมู่บ้าน</h1>
        <p className="mt-1 text-sm text-slate-600">ส่งประกาศส่วนกลางให้ผู้ใช้ทุกบัญชีและบันทึกเป็นประกาศฉุกเฉินของแต่ละหมู่บ้านอัตโนมัติ</p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">สร้างประกาศใหม่</h2>
        <BroadcastForm />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">ประกาศล่าสุด (System Notification)</h2>
          {recentSystemNotifications.length === 0 ? (
            <p className="text-sm text-slate-500">ยังไม่มีประวัติประกาศ</p>
          ) : (
            <div className="space-y-2">
              {recentSystemNotifications.map((item) => (
                <div key={item.id} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                  <p className="text-sm font-medium text-slate-800">{item.title}</p>
                  <p className="text-xs text-slate-600">{item.body}</p>
                  <p className="mt-1 text-xs text-slate-400">{item.createdAt.toLocaleString("th-TH")}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">ประกาศที่กระจายไปหมู่บ้าน</h2>
          {recentEmergencyBroadcasts.length === 0 ? (
            <p className="text-sm text-slate-500">ยังไม่มีข้อมูลประกาศระดับหมู่บ้าน</p>
          ) : (
            <div className="space-y-2">
              {recentEmergencyBroadcasts.map((item) => (
                <div key={item.id} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                  <p className="text-sm font-medium text-slate-800">{item.village.name} • {item.title}</p>
                  <p className="text-xs text-slate-600 line-clamp-2">{item.content}</p>
                  <p className="mt-1 text-xs text-slate-400">{item.createdAt.toLocaleString("th-TH")}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
