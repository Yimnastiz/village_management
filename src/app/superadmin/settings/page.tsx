import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";
import { deleteGlobalSettingAction, upsertGlobalSettingAction } from "./actions";

export default async function SuperAdminSettingsPage() {
  await requireSuperAdminPageSession();

  const settings = await prisma.fAQItem.findMany({
    where: {
      category: "GLOBAL_SETTING",
      villageId: null,
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">ตั้งค่ากลางระบบ</h1>
        <p className="mt-1 text-sm text-slate-600">กำหนดค่าระดับ global สำหรับทุกหมู่บ้าน</p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">เพิ่ม/อัปเดตการตั้งค่า</h2>
        <form action={upsertGlobalSettingAction} className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          <input name="settingKey" placeholder="คีย์ เช่น system.maintenanceMode" className="rounded-md border border-slate-300 px-3 py-2 text-sm" required />
          <input name="settingValue" placeholder="ค่า เช่น false" className="rounded-md border border-slate-300 px-3 py-2 text-sm" required />
          <div className="md:col-span-2">
            <button type="submit" className="rounded-md bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700">
              บันทึกการตั้งค่า
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">รายการตั้งค่าปัจจุบัน</h2>
        {settings.length === 0 ? (
          <p className="text-sm text-slate-500">ยังไม่มีการตั้งค่ากลาง</p>
        ) : (
          <div className="space-y-2">
            {settings.map((setting) => (
              <div key={setting.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <p className="text-sm font-semibold text-slate-800">{setting.question}</p>
                <p className="mt-1 text-sm text-slate-600">{setting.answer}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <form action={deleteGlobalSettingAction}>
                    <input type="hidden" name="id" value={setting.id} />
                    <button type="submit" className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100">
                      ลบการตั้งค่า
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
