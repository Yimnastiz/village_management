import {
  assignVillageAdminRoleAction,
  removeVillageAdminRoleAction,
  suspendUserMembershipsAction,
  updateUserSystemRoleAction,
} from "./actions";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";

const ADMIN_ROLES = ["HEADMAN", "ASSISTANT_HEADMAN", "COMMITTEE"] as const;

export default async function SuperAdminUsersPage() {
  await requireSuperAdminPageSession();

  const [users, villages] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 80,
      include: {
        memberships: {
          include: {
            village: {
              select: { id: true, name: true },
            },
          },
          orderBy: { updatedAt: "desc" },
        },
      },
    }),
    prisma.village.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">จัดการผู้ใช้ทุกหมู่บ้าน</h1>
        <p className="mt-1 text-sm text-slate-600">ปรับสิทธิ์ระดับระบบ กำหนด/ถอดบทบาท Headman และ Assistant Headman ได้จากหน้านี้</p>
      </div>

      <div className="space-y-3">
        {users.map((user) => {
          const adminMemberships = user.memberships.filter((membership) =>
            ADMIN_ROLES.includes(membership.role as (typeof ADMIN_ROLES)[number])
          );

          return (
            <div key={user.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-base font-semibold text-slate-900">{user.name}</p>
                  <p className="text-xs text-slate-500">{user.phoneNumber} • {user.id}</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${user.systemRole === "SUPERADMIN" ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-700"}`}>
                  {user.systemRole}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <form action={updateUserSystemRoleAction} className="rounded-lg border border-slate-200 p-3">
                  <input type="hidden" name="userId" value={user.id} />
                  <p className="mb-2 text-sm font-medium text-slate-800">บทบาทระดับระบบ</p>
                  <div className="flex gap-2">
                    <select name="systemRole" defaultValue={user.systemRole} className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm">
                      <option value="USER">USER</option>
                      <option value="SUPERADMIN">SUPERADMIN</option>
                    </select>
                    <button type="submit" className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">
                      บันทึก
                    </button>
                  </div>
                </form>

                <form action={assignVillageAdminRoleAction} className="rounded-lg border border-slate-200 p-3">
                  <input type="hidden" name="userId" value={user.id} />
                  <p className="mb-2 text-sm font-medium text-slate-800">แต่งตั้งบทบาทผู้บริหารหมู่บ้าน</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <select name="villageId" className="rounded-md border border-slate-300 px-3 py-2 text-sm" required>
                      <option value="">เลือกหมู่บ้าน</option>
                      {villages.map((village) => (
                        <option key={village.id} value={village.id}>{village.name}</option>
                      ))}
                    </select>
                    <select name="membershipRole" className="rounded-md border border-slate-300 px-3 py-2 text-sm" required>
                      <option value="HEADMAN">HEADMAN</option>
                      <option value="ASSISTANT_HEADMAN">ASSISTANT_HEADMAN</option>
                      <option value="COMMITTEE">COMMITTEE</option>
                    </select>
                    <button type="submit" className="rounded-md bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-700">
                      แต่งตั้ง
                    </button>
                  </div>
                </form>
              </div>

              <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                <p className="mb-2 text-sm font-medium text-slate-800">บทบาทผู้บริหารที่มีอยู่</p>
                {adminMemberships.length === 0 ? (
                  <p className="text-xs text-slate-500">ยังไม่มีบทบาท Headman/Assistant/Committee</p>
                ) : (
                  <div className="space-y-2">
                    {adminMemberships.map((membership) => (
                      <div key={membership.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
                        <span>
                          {membership.village.name} • {membership.role} • {membership.status}
                        </span>
                        <form action={removeVillageAdminRoleAction}>
                          <input type="hidden" name="membershipId" value={membership.id} />
                          <button type="submit" className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100">
                            ถอดจากบทบาทผู้บริหาร
                          </button>
                        </form>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-3">
                <form action={suspendUserMembershipsAction}>
                  <input type="hidden" name="userId" value={user.id} />
                  <button type="submit" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100">
                    ระงับสมาชิกทุกหมู่บ้านของผู้ใช้นี้
                  </button>
                </form>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
