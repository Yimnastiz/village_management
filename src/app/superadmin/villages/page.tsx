import {
  createVillageAction,
  deleteVillageAction,
  toggleVillageActiveAction,
  updateVillageAction,
} from "./actions";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";

function Input({ name, defaultValue, placeholder }: { name: string; defaultValue?: string | null; placeholder?: string }) {
  return (
    <input
      name={name}
      defaultValue={defaultValue ?? ""}
      placeholder={placeholder}
      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
    />
  );
}

export default async function SuperAdminVillagesPage() {
  await requireSuperAdminPageSession();

  const villages = await prisma.village.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: {
      _count: {
        select: {
          memberships: true,
          houses: true,
          news: true,
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">จัดการหมู่บ้าน</h1>
        <p className="mt-1 text-sm text-slate-600">สร้าง แก้ไข ปิดการใช้งาน และลบหมู่บ้านจากศูนย์กลาง</p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">สร้างหมู่บ้านใหม่</h2>
        <form action={createVillageAction} className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
          <Input name="name" placeholder="ชื่อหมู่บ้าน" />
          <Input name="slug" placeholder="slug เช่น banmai" />
          <Input name="province" placeholder="จังหวัด" />
          <Input name="district" placeholder="อำเภอ" />
          <Input name="subdistrict" placeholder="ตำบล" />
          <Input name="phone" placeholder="เบอร์โทรติดต่อ" />
          <div className="md:col-span-2">
            <Input name="address" placeholder="ที่อยู่" />
          </div>
          <Input name="email" placeholder="อีเมล" />
          <div className="md:col-span-2">
            <Input name="website" placeholder="เว็บไซต์ (ถ้ามี)" />
          </div>
          <Input name="description" placeholder="คำอธิบายหมู่บ้าน" />
          <div className="md:col-span-3">
            <button type="submit" className="rounded-md bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700">
              สร้างหมู่บ้าน
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        {villages.map((village) => (
          <div key={village.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-lg font-semibold text-slate-900">{village.name}</p>
                <p className="text-xs text-slate-500">/{village.slug}</p>
              </div>
              <span className={`rounded-full px-2 py-1 text-xs font-semibold ${village.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
                {village.isActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}
              </span>
            </div>

            <p className="mb-3 text-xs text-slate-500">
              สมาชิก {village._count.memberships} • บ้าน {village._count.houses} • ข่าว {village._count.news}
            </p>

            <form action={updateVillageAction} className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <input type="hidden" name="id" value={village.id} />
              <Input name="name" defaultValue={village.name} />
              <Input name="slug" defaultValue={village.slug} />
              <Input name="province" defaultValue={village.province} />
              <Input name="district" defaultValue={village.district} />
              <Input name="subdistrict" defaultValue={village.subdistrict} />
              <Input name="phone" defaultValue={village.phone} />
              <div className="md:col-span-2">
                <Input name="address" defaultValue={village.address} />
              </div>
              <Input name="email" defaultValue={village.email} />
              <div className="md:col-span-2">
                <Input name="website" defaultValue={village.website} />
              </div>
              <Input name="description" defaultValue={village.description} />
              <div className="md:col-span-3 flex flex-wrap gap-2">
                <button type="submit" className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">
                  บันทึกข้อมูลหมู่บ้าน
                </button>
              </div>
            </form>

            <div className="mt-3 flex flex-wrap gap-2">
              <form action={toggleVillageActiveAction}>
                <input type="hidden" name="id" value={village.id} />
                <input type="hidden" name="nextActive" value={String(!village.isActive)} />
                <button type="submit" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                  {village.isActive ? "ปิดการใช้งาน" : "เปิดการใช้งาน"}
                </button>
              </form>

              <form action={deleteVillageAction}>
                <input type="hidden" name="id" value={village.id} />
                <button type="submit" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 hover:bg-rose-100">
                  ลบหมู่บ้าน
                </button>
              </form>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
