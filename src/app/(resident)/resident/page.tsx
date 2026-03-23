import { MapPin } from "lucide-react";
import { redirect } from "next/navigation";
import { getSessionContextFromServerCookies, setActiveVillageForCurrentSession } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

export default async function ResidentRootPage() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) {
    redirect("/auth/login?callbackUrl=/resident");
  }

  const residentMemberships = session.memberships.filter(
    (membership) => membership.role === "RESIDENT" && membership.status === "ACTIVE"
  );

  if (residentMemberships.length === 0) {
    redirect("/auth/binding");
  }

  if (residentMemberships.length === 1) {
    const [onlyMembership] = residentMemberships;
    if (onlyMembership?.villageId && session.activeVillageId !== onlyMembership.villageId) {
      await setActiveVillageForCurrentSession(onlyMembership.villageId);
    }
    redirect("/resident/dashboard");
  }

  const villages = await prisma.village.findMany({
    where: {
      id: {
        in: residentMemberships.map((membership) => membership.villageId),
      },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      district: true,
      province: true,
    },
    orderBy: [{ name: "asc" }],
  });

  async function switchVillageAction(formData: FormData) {
    "use server";

    const villageId = formData.get("villageId")?.toString() ?? "";
    if (!villageId) {
      redirect("/resident");
    }

    const switched = await setActiveVillageForCurrentSession(villageId);
    if (!switched) {
      redirect("/resident?error=switch-failed");
    }

    redirect("/resident/dashboard");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">เลือกหมู่บ้านที่ต้องการดูข้อมูล</h1>
        <p className="mt-1 text-sm text-gray-500">คุณสามารถสลับหมู่บ้านได้จากหน้าแรกเมื่อมีสมาชิกภาพมากกว่าหนึ่งหมู่บ้าน</p>
      </div>

      <div className="space-y-3">
        {villages.map((village) => {
          const isActive = session.activeVillageId === village.id;
          return (
            <form key={village.id} action={switchVillageAction}>
              <input type="hidden" name="villageId" value={village.id} />
              <button
                type="submit"
                className={`w-full rounded-xl border p-4 text-left transition-colors ${
                  isActive
                    ? "border-green-500 bg-green-50"
                    : "border-gray-200 bg-white hover:border-green-300 hover:bg-green-50/40"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-green-100 p-2">
                      <MapPin className="h-5 w-5 text-green-700" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{village.name}</p>
                      <p className="text-xs text-gray-500">
                        {village.district}, {village.province}
                      </p>
                    </div>
                  </div>
                  {isActive && (
                    <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                      กำลังใช้งาน
                    </span>
                  )}
                </div>
              </button>
            </form>
          );
        })}
      </div>
    </div>
  );
}
