"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SuperAdminPageHeaderRegistration } from "@/components/layout/superadmin-page-header-context";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { ACCOUNT_STATUS_LABELS, MEMBERSHIP_ROLE_LABELS, MEMBERSHIP_STATUS_LABELS } from "@/lib/constants";
import { updateUserProfileAction } from "./actions";

type Membership = {
  id: string;
  villageId: string;
  role: string;
  status: string;
  joinedAt: string | null;
  village: { id: string; name: string; subdistrict: string | null; district: string | null; province: string | null };
  houseNumber: string | null;
};

type UserDetail = {
  id: string;
  name: string;
  phoneNumber: string;
  email: string | null;
  image: string | null;
  systemRole: string;
  accountStatus: string;
  registrationProvince: string | null;
  registrationDistrict: string | null;
  registrationSubdistrict: string | null;
  registrationVillage: { name: string } | null;
  createdAt: string;
  updatedAt: string;
};

function accountStatusClass(status: string) {
  if (status === "ACTIVE") return "bg-emerald-50 text-emerald-700";
  if (status === "SUSPENDED" || status === "ANONYMIZED") return "bg-red-50 text-red-700";
  if (status === "PENDING" || status === "DELETION_PENDING") return "bg-amber-50 text-amber-700";
  return "bg-gray-100 text-gray-700";
}

function membershipStatusClass(status: string) {
  return status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700";
}

function statusExplanation(status: string) {
  if (status === "SUSPENDED") return "บัญชีถูกระงับการใช้งานอยู่";
  if (status === "PENDING") return "บัญชียังอยู่ระหว่างการตรวจสอบ";
  if (status === "DELETION_PENDING") return "บัญชีอยู่ระหว่างกระบวนการปิดบัญชี";
  if (status === "ANONYMIZED") return "บัญชีนี้ถูกปิดและทำให้ไม่สามารถระบุตัวตนได้แล้ว";
  if (status === "DUPLICATE_ID") return "ระบบระบุว่าข้อมูลระบุตัวตนของบัญชีนี้ซ้ำ";
  return null;
}

function Detail({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="mt-1 break-words text-sm text-gray-900">{children}</dd>
    </div>
  );
}

export function UserDetailClient({ user, memberships }: { user: UserDetail; memberships: Membership[] }) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const explanation = statusExplanation(user.accountStatus);

  const submitProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    try {
      const formData = new FormData(event.currentTarget);
      formData.set("userId", user.id);
      await updateUserProfileAction(formData);
      pushToast({ tone: "success", title: "บันทึกข้อมูลบัญชีแล้ว", description: user.name });
      setEditOpen(false);
      router.refresh();
    } catch (error) {
      pushToast({
        tone: "error",
        title: "บันทึกข้อมูลไม่สำเร็จ",
        description: error instanceof Error ? error.message : "เกิดข้อผิดพลาด",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mx-auto -mt-4 w-full max-w-5xl space-y-4 sm:-mt-6">
      <SuperAdminPageHeaderRegistration
        priority={1}
        context={{
          title: user.name.trim() || "รายละเอียดผู้ใช้งาน",
          description: "ตรวจสอบข้อมูลบัญชีและการสังกัดหมู่บ้าน",
        }}
      />

      <nav className="flex flex-wrap items-center justify-between gap-2 border-y border-gray-200 bg-white/95 px-1 py-2" aria-label="การนำทางรายละเอียดผู้ใช้งาน">
        <Link href="/superadmin/users" className="inline-flex min-h-9 items-center rounded-md px-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2">
          กลับรายการผู้ใช้งาน
        </Link>
        <Button type="button" size="sm" variant="outline" onClick={() => setEditOpen(true)}>
          แก้ไขข้อมูลบัญชี
        </Button>
      </nav>

      <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-3">
          <h2 className="text-lg font-semibold text-gray-900">ข้อมูลบัญชี</h2>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${accountStatusClass(user.accountStatus)}`}>
            {ACCOUNT_STATUS_LABELS[user.accountStatus] ?? "ไม่ทราบสถานะ"}
          </span>
        </div>
        {explanation ? <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">{explanation}</p> : null}
        <dl className="grid gap-x-6 gap-y-4 pt-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="ชื่อ">{user.name}</Detail>
          <Detail label="เบอร์โทรศัพท์">{user.phoneNumber || "-"}</Detail>
          <Detail label="อีเมล" className="break-all">{user.email ?? "-"}</Detail>
          <Detail label="วันที่สร้างบัญชี">{new Date(user.createdAt).toLocaleDateString("th-TH")}</Detail>
          <Detail label="อัปเดตล่าสุด">{new Date(user.updatedAt).toLocaleString("th-TH")}</Detail>
          {user.systemRole === "SUPERADMIN" ? <Detail label="ประเภทบัญชี">ผู้ดูแลระบบระดับสูง</Detail> : null}
        </dl>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
        <div className="border-b border-gray-100 pb-3">
          <h2 className="text-lg font-semibold text-gray-900">การสังกัดหมู่บ้าน</h2>
          <p className="mt-1 text-sm text-gray-500">จัดการบทบาท สถานะสมาชิก และการผูกเลขบ้านจากพื้นที่ทำงานของหมู่บ้าน</p>
        </div>
        {memberships.length === 0 ? (
          <div className="py-6 text-sm text-gray-500">
            <p className="font-medium text-gray-700">ยังไม่ได้สังกัดหมู่บ้าน</p>
            <p className="mt-1">การเพิ่มหรือผูกสมาชิกต้องดำเนินการจากพื้นที่ทำงานของหมู่บ้าน</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {memberships.map((membership) => {
              const location = [
                membership.village.subdistrict && `ต.${membership.village.subdistrict}`,
                membership.village.district && `อ.${membership.village.district}`,
                membership.village.province && `จ.${membership.village.province}`,
              ].filter(Boolean);
              const manageLabel = ["HEADMAN", "ASSISTANT_HEADMAN"].includes(membership.role)
                ? "จัดการบทบาทในหมู่บ้าน"
                : "จัดการในหมู่บ้าน";

              return (
                <article key={membership.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="break-words font-medium text-gray-900">{membership.village.name}</p>
                    {location.length ? <p className="mt-1 break-words text-xs text-gray-500">{location.join(" · ")}</p> : null}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-gray-600">
                      <span>{MEMBERSHIP_ROLE_LABELS[membership.role] ?? "สมาชิกหมู่บ้าน"}</span>
                      <span aria-hidden="true">·</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${membershipStatusClass(membership.status)}`}>
                        {MEMBERSHIP_STATUS_LABELS[membership.status] ?? "ไม่ทราบสถานะ"}
                      </span>
                      {membership.houseNumber ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>บ้านเลขที่ {membership.houseNumber}</span>
                        </>
                      ) : null}
                      {membership.joinedAt ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-xs text-gray-500">เข้าร่วม {new Date(membership.joinedAt).toLocaleDateString("th-TH")}</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <Link href={`/superadmin/villages/${membership.villageId}/users`} className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-md px-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2">
                    {manageLabel}
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {(user.registrationVillage || user.registrationSubdistrict || user.registrationDistrict || user.registrationProvince) ? (
        <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
          <h2 className="text-base font-semibold text-gray-900">ข้อมูลที่ระบุตอนสมัคร</h2>
          <p className="mt-1 text-sm text-gray-500">ข้อมูลนี้ใช้ประกอบการลงทะเบียน และไม่ใช่การสังกัดหมู่บ้านปัจจุบัน</p>
          <dl className="mt-4 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Detail label="หมู่บ้าน">{user.registrationVillage?.name ?? "-"}</Detail>
            <Detail label="ตำบล">{user.registrationSubdistrict ?? "-"}</Detail>
            <Detail label="อำเภอ">{user.registrationDistrict ?? "-"}</Detail>
            <Detail label="จังหวัด">{user.registrationProvince ?? "-"}</Detail>
          </dl>
        </section>
      ) : null}

      <Dialog
        open={editOpen}
        title="แก้ไขข้อมูลบัญชี"
        description="ปรับปรุงข้อมูลบัญชีที่รองรับ โดยไม่เปลี่ยนบทบาทหรือการสังกัดหมู่บ้าน"
        onClose={() => !pending && setEditOpen(false)}
        closeOnBackdrop={!pending}
        closeOnEscape={!pending}
        footer={(
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" disabled={pending} onClick={() => setEditOpen(false)}>ยกเลิก</Button>
            <Button type="submit" form="user-profile-edit" isLoading={pending} disabled={pending}>บันทึกข้อมูล</Button>
          </div>
        )}
      >
        <form id="user-profile-edit" onSubmit={submitProfile} className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium text-gray-700">
            ชื่อ
            <input name="name" defaultValue={user.name} required className="min-h-10 rounded-lg border border-gray-300 px-3 font-normal focus:border-cyan-600 focus:outline-none focus:ring-1 focus:ring-cyan-600" />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-gray-700">
            เบอร์โทรศัพท์
            <input name="phoneNumber" type="tel" defaultValue={user.phoneNumber} required className="min-h-10 rounded-lg border border-gray-300 px-3 font-normal focus:border-cyan-600 focus:outline-none focus:ring-1 focus:ring-cyan-600" />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-gray-700 sm:col-span-2">
            อีเมล
            <input name="email" type="email" defaultValue={user.email ?? ""} className="min-h-10 rounded-lg border border-gray-300 px-3 font-normal focus:border-cyan-600 focus:outline-none focus:ring-1 focus:ring-cyan-600" />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-gray-700 sm:col-span-2">
            URL รูปโปรไฟล์
            <input name="image" type="url" defaultValue={user.image ?? ""} className="min-h-10 rounded-lg border border-gray-300 px-3 font-normal focus:border-cyan-600 focus:outline-none focus:ring-1 focus:ring-cyan-600" />
          </label>
          <input type="hidden" name="registrationProvince" value={user.registrationProvince ?? ""} />
          <input type="hidden" name="registrationDistrict" value={user.registrationDistrict ?? ""} />
          <input type="hidden" name="registrationSubdistrict" value={user.registrationSubdistrict ?? ""} />
        </form>
      </Dialog>
    </div>
  );
}
