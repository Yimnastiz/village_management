"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import {
  createUserMembershipAction,
  deleteUserAccountAction,
  deleteUserMembershipAction,
  updateUserMembershipAction,
  updateUserProfileAction,
  updateUserSystemRoleAction,
} from "./actions";

type VillageOption = {
  id: string;
  name: string;
};

type MembershipOption = {
  id: string;
  villageId: string;
  villageName: string;
  role: string;
  status: string;
  houseId: string | null;
};

type UserDetail = {
  id: string;
  name: string;
  phoneNumber: string;
  email: string | null;
  image: string | null;
  systemRole: string;
  registrationProvince: string | null;
  registrationDistrict: string | null;
  registrationSubdistrict: string | null;
};

type ConfirmState = {
  title: string;
  description: string;
  tone: "default" | "danger";
  action: () => Promise<void>;
} | null;

export function UserDetailClient({
  user,
  villages,
  memberships,
}: {
  user: UserDetail;
  villages: VillageOption[];
  memberships: MembershipOption[];
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [pending, setPending] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);

  const runAction = async (work: () => Promise<void>, successTitle: string, successDescription?: string) => {
    setPending(true);
    try {
      await work();
      pushToast({ tone: "success", title: successTitle, description: successDescription });
      router.refresh();
    } catch (error) {
      pushToast({
        tone: "error",
        title: "ดำเนินการไม่สำเร็จ",
        description: error instanceof Error ? error.message : "เกิดข้อผิดพลาด",
      });
    } finally {
      setPending(false);
      setConfirmState(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">จัดการผู้ใช้แบบละเอียด</h1>
          <p className="mt-1 text-sm text-slate-600">{user.name} • {user.phoneNumber} • {user.id}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/superadmin/users" className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            กลับหน้ารายการผู้ใช้
          </Link>
          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${user.systemRole === "SUPERADMIN" ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-700"}`}>
            {user.systemRole}
          </span>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">ข้อมูลบัญชีผู้ใช้</h2>
        <form
          className="grid grid-cols-1 gap-3 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            formData.set("userId", user.id);
            void runAction(() => updateUserProfileAction(formData), "บันทึกข้อมูลผู้ใช้แล้ว", user.name);
          }}
        >
          <label className="text-sm text-slate-700">
            ชื่อ
            <input name="name" defaultValue={user.name} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" required />
          </label>
          <label className="text-sm text-slate-700">
            เบอร์โทรศัพท์
            <input name="phoneNumber" defaultValue={user.phoneNumber} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" required />
          </label>
          <label className="text-sm text-slate-700">
            อีเมล
            <input name="email" defaultValue={user.email ?? ""} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <label className="text-sm text-slate-700">
            URL รูปโปรไฟล์
            <input name="image" defaultValue={user.image ?? ""} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <label className="text-sm text-slate-700">
            จังหวัดตอนสมัคร
            <input name="registrationProvince" defaultValue={user.registrationProvince ?? ""} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <label className="text-sm text-slate-700">
            อำเภอตอนสมัคร
            <input name="registrationDistrict" defaultValue={user.registrationDistrict ?? ""} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <label className="text-sm text-slate-700 md:col-span-2">
            ตำบลตอนสมัคร
            <input name="registrationSubdistrict" defaultValue={user.registrationSubdistrict ?? ""} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </label>
          <div className="md:col-span-2">
            <Button type="submit">บันทึกข้อมูลผู้ใช้</Button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">บทบาทระดับระบบ</h2>
        <form
          className="flex flex-wrap items-center gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            formData.set("userId", user.id);
            const nextRole = String(formData.get("systemRole") ?? "USER");
            setConfirmState({
              title: "ยืนยันเปลี่ยนบทบาทระดับระบบ",
              description: `ต้องการเปลี่ยนบทบาทของ ${user.name} เป็น ${nextRole}`,
              tone: nextRole === "SUPERADMIN" ? "danger" : "default",
              action: async () => {
                await runAction(() => updateUserSystemRoleAction(formData), "อัปเดตบทบาทระดับระบบแล้ว", `${user.name} → ${nextRole}`);
              },
            });
          }}
        >
          <select name="systemRole" defaultValue={user.systemRole} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="USER">USER</option>
            <option value="SUPERADMIN">SUPERADMIN</option>
          </select>
          <Button type="submit" variant="secondary">บันทึกบทบาทระบบ</Button>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">เพิ่ม/แก้ไขสมาชิกหมู่บ้าน</h2>
        <form
          className="grid grid-cols-1 gap-3 md:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            formData.set("userId", user.id);
            void runAction(() => createUserMembershipAction(formData), "บันทึกสมาชิกหมู่บ้านแล้ว", user.name);
          }}
        >
          <select name="villageId" className="rounded-md border border-slate-300 px-3 py-2 text-sm" required>
            <option value="">เลือกหมู่บ้าน</option>
            {villages.map((village) => (
              <option key={village.id} value={village.id}>{village.name}</option>
            ))}
          </select>
          <select name="role" defaultValue="RESIDENT" className="rounded-md border border-slate-300 px-3 py-2 text-sm" required>
            <option value="RESIDENT">RESIDENT</option>
            <option value="ASSISTANT_HEADMAN">ASSISTANT_HEADMAN</option>
            <option value="HEADMAN">HEADMAN</option>
          </select>
          <select name="status" defaultValue="ACTIVE" className="rounded-md border border-slate-300 px-3 py-2 text-sm" required>
            <option value="ACTIVE">ACTIVE</option>
            <option value="PENDING">PENDING</option>
            <option value="SUSPENDED">SUSPENDED</option>
            <option value="REJECTED">REJECTED</option>
          </select>
          <input name="houseId" placeholder="houseId (ไม่บังคับ)" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <div className="md:col-span-4">
            <Button type="submit" className="bg-cyan-600 hover:bg-cyan-700 focus:ring-cyan-500">เพิ่ม/บันทึกสมาชิกหมู่บ้าน</Button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">รายการสมาชิกที่มีอยู่</h2>
        {memberships.length === 0 ? (
          <p className="text-sm text-slate-500">ยังไม่มีสมาชิกหมู่บ้าน</p>
        ) : (
          <div className="space-y-3">
            {memberships.map((membership) => (
              <form
                key={membership.id}
                className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const formData = new FormData(event.currentTarget);
                  formData.set("membershipId", membership.id);
                  formData.set("userId", user.id);
                  void runAction(() => updateUserMembershipAction(formData), "อัปเดตสมาชิกหมู่บ้านแล้ว", membership.villageName);
                }}
              >
                <p className="mb-2 text-sm font-medium text-slate-900">{membership.villageName}</p>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                  <select name="role" defaultValue={membership.role} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
                    <option value="RESIDENT">RESIDENT</option>
                    <option value="ASSISTANT_HEADMAN">ASSISTANT_HEADMAN</option>
                    <option value="HEADMAN">HEADMAN</option>
                  </select>
                  <select name="status" defaultValue={membership.status} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="PENDING">PENDING</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                    <option value="REJECTED">REJECTED</option>
                  </select>
                  <input name="houseId" defaultValue={membership.houseId ?? ""} placeholder="houseId (ไม่บังคับ)" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
                  <div className="flex gap-2">
                    <Button type="submit" variant="secondary">บันทึก</Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setConfirmState({
                          title: "ยืนยันลบสมาชิกหมู่บ้าน",
                          description: `ต้องการลบสมาชิกของ ${user.name} จาก ${membership.villageName}`,
                          tone: "danger",
                          action: async () => {
                            const formData = new FormData();
                            formData.set("membershipId", membership.id);
                            formData.set("userId", user.id);
                            await runAction(() => deleteUserMembershipAction(formData), "ลบสมาชิกหมู่บ้านแล้ว", membership.villageName);
                          },
                        });
                      }}
                    >
                      ลบ
                    </Button>
                  </div>
                </div>
              </form>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold text-red-800">โซนอันตราย</h2>
        <p className="mb-3 text-sm text-red-700">ลบบัญชีผู้ใช้นี้พร้อมข้อมูลที่ผูกกับผู้ใช้ตามกฎ onDelete ของระบบ</p>
        <Button
          type="button"
          variant="danger"
          onClick={() => {
            setConfirmState({
              title: "ยืนยันลบบัญชีผู้ใช้",
              description: `ต้องการลบบัญชี ${user.name} อย่างถาวรใช่หรือไม่`,
              tone: "danger",
              action: async () => {
                const formData = new FormData();
                formData.set("userId", user.id);
                await runAction(() => deleteUserAccountAction(formData), "ลบบัญชีผู้ใช้แล้ว", user.name);
                router.push("/superadmin/users");
              },
            });
          }}
        >
          ลบบัญชีผู้ใช้
        </Button>
      </section>

      <ConfirmDialog
        open={Boolean(confirmState)}
        title={confirmState?.title ?? ""}
        description={confirmState?.description}
        tone={confirmState?.tone}
        pending={pending}
        onClose={() => !pending && setConfirmState(null)}
        onConfirm={() => {
          void confirmState?.action();
        }}
      />
    </div>
  );
}
