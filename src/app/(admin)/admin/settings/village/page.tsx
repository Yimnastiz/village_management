import { MembershipStatus, VillageMembershipRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { computeLandingPath, getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { updateVillageSettingsAction } from "../actions";

export default async function Page() {
  const session = await getSessionContextFromServerCookies();
  if (!session) redirect("/auth/login?callbackUrl=/admin/settings/village");
  if (!isAdminUser(session)) redirect(computeLandingPath(session));

  const membership = await prisma.villageMembership.findFirst({
    where: {
      userId: session.id,
      status: MembershipStatus.ACTIVE,
      role: { in: [VillageMembershipRole.HEADMAN, VillageMembershipRole.ASSISTANT_HEADMAN, VillageMembershipRole.COMMITTEE] },
    },
    select: { villageId: true },
  });
  if (!membership) redirect(computeLandingPath(session));

  const village = await prisma.village.findUnique({
    where: { id: membership.villageId },
  });
  if (!village) redirect(computeLandingPath(session));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">ตั้งค่าหมู่บ้าน</h1>

      <form action={updateVillageSettingsAction} className="rounded-xl border border-gray-200 bg-white p-6 space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm text-gray-700">ชื่อหมู่บ้าน</span>
            <input name="name" defaultValue={village.name} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1">
            <span className="text-sm text-gray-700">Slug</span>
            <input value={village.slug} disabled className="w-full rounded-lg border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-500" />
          </label>
        </div>

        <label className="space-y-1 block">
          <span className="text-sm text-gray-700">คำอธิบาย</span>
          <textarea name="description" defaultValue={village.description ?? ""} rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </label>

        <label className="space-y-1 block">
          <span className="text-sm text-gray-700">ที่อยู่</span>
          <textarea name="address" defaultValue={village.address ?? ""} rows={2} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </label>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-sm text-gray-700">จังหวัด</span>
            <input name="province" defaultValue={village.province ?? ""} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1">
            <span className="text-sm text-gray-700">อำเภอ</span>
            <input name="district" defaultValue={village.district ?? ""} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1">
            <span className="text-sm text-gray-700">ตำบล</span>
            <input name="subdistrict" defaultValue={village.subdistrict ?? ""} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-sm text-gray-700">เบอร์โทร</span>
            <input name="phone" defaultValue={village.phone ?? ""} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1">
            <span className="text-sm text-gray-700">อีเมล</span>
            <input name="email" type="email" defaultValue={village.email ?? ""} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1">
            <span className="text-sm text-gray-700">เว็บไซต์</span>
            <input name="website" defaultValue={village.website ?? ""} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm text-gray-700">Logo URL</span>
            <input name="logoUrl" defaultValue={village.logoUrl ?? ""} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1">
            <span className="text-sm text-gray-700">Banner URL</span>
            <input name="bannerUrl" defaultValue={village.bannerUrl ?? ""} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </label>
        </div>

        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" name="isActive" defaultChecked={village.isActive} className="h-4 w-4 rounded border-gray-300" />
          เปิดใช้งานหมู่บ้านนี้
        </label>

        <div className="flex justify-end">
          <Button type="submit">บันทึกการตั้งค่า</Button>
        </div>
      </form>
    </div>
  );
}
