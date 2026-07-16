"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import {
  updateUserSystemRoleAction,
} from "./actions";

type VillageOption = { id: string; name: string };
type MembershipRow = {
  id: string;
  role: string;
  status: string;
  village: { id: string; name: string; subdistrict: string | null; district: string | null; province: string | null };
  house: { houseNumber: string } | null;
};
type UserRow = {
  id: string;
  name: string;
  phoneNumber: string;
  systemRole: string;
  accountStatus: string;
  registrationProvince: string | null;
  registrationDistrict: string | null;
  registrationSubdistrict: string | null;
  registrationVillage: { name: string } | null;
  memberships: MembershipRow[];
};

type DialogState = {
  title: string;
  description: string;
  tone: "default" | "danger";
  action: () => Promise<void>;
} | null;

const ADMIN_ROLES = new Set(["HEADMAN", "ASSISTANT_HEADMAN", "COMMITTEE"]);

export function UserManagementCard({ user, villages }: { user: UserRow; villages: VillageOption[] }) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [pending, setPending] = useState(false);
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const adminMemberships = user.memberships.filter((membership) => ADMIN_ROLES.has(membership.role));

  const runAction = async (work: () => Promise<void>, successTitle: string, successDescription: string) => {
    setPending(true);
    try {
      await work();
      pushToast({ tone: "success", title: successTitle, description: successDescription });
      router.refresh();
    } catch (error) {
      pushToast({ tone: "error", title: "ดำเนินการไม่สำเร็จ", description: error instanceof Error ? error.message : "เกิดข้อผิดพลาด" });
    } finally {
      setPending(false);
      setDialogState(null);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-base font-semibold text-slate-900">{user.name}</p>
          <p className="text-xs text-slate-500">{user.phoneNumber} • {user.id}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">{user.accountStatus}</span>
          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${user.systemRole === "SUPERADMIN" ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-700"}`}>
            {user.systemRole}
          </span>
          <Link href={`/superadmin/users/${user.id}`} className="inline-flex items-center rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
            ดูรายละเอียด
          </Link>
        </div>
      </div>

      <div className="mb-3 grid gap-3 text-sm md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 p-3"><p className="font-medium text-slate-800">พื้นที่ที่ระบุตอนสมัคร</p><p className="mt-1 text-slate-600">{user.registrationVillage?.name ?? "ไม่ระบุหมู่บ้าน"}</p><p className="text-xs text-slate-500">ต.{user.registrationSubdistrict ?? "-"} อ.{user.registrationDistrict ?? "-"} จ.{user.registrationProvince ?? "-"}</p></div>
        <div className="rounded-lg border border-slate-200 p-3"><p className="font-medium text-slate-800">หมู่บ้านที่สังกัดจริง</p>{user.memberships.length === 0 ? <p className="mt-1 text-slate-500">ยังไม่ได้สังกัดหมู่บ้าน</p> : user.memberships.map((membership) => <div key={membership.id} className="mt-1 text-slate-600"><p>{membership.village.name} · {membership.role} · {membership.status}{membership.house ? ` · บ้านเลขที่ ${membership.house.houseNumber}` : ""}</p><p className="text-xs text-slate-500">ต.{membership.village.subdistrict ?? "-"} อ.{membership.village.district ?? "-"} จ.{membership.village.province ?? "-"}</p></div>)}</div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <form
          className="rounded-lg border border-slate-200 p-3"
          onSubmit={async (event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            const nextRole = String(formData.get("systemRole") ?? "USER");
            setDialogState({
              title: "ยืนยันเปลี่ยนบทบาทระดับระบบ",
              description: `ต้องการเปลี่ยนบทบาทของ ${user.name} เป็น ${nextRole} ใช่หรือไม่`,
              tone: nextRole === "SUPERADMIN" ? "danger" : "default",
              action: async () => {
                await runAction(() => updateUserSystemRoleAction(formData), "อัปเดตบทบาทระดับระบบแล้ว", `${user.name} → ${nextRole}`);
              },
            });
          }}
        >
          <input type="hidden" name="userId" value={user.id} />
          <p className="mb-2 text-sm font-medium text-slate-800">บทบาทระดับระบบ</p>
          <div className="flex gap-2">
            <select name="systemRole" defaultValue={user.systemRole} className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="USER">USER</option>
              <option value="SUPERADMIN">SUPERADMIN</option>
            </select>
            <Button type="submit" variant="secondary">บันทึก</Button>
          </div>
          <input name="reason" required minLength={5} placeholder="เหตุผลในการเปลี่ยนสิทธิ์" className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </form>

        <form
          className="rounded-lg border border-slate-200 p-3"
          onSubmit={async (event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            const villageId = String(formData.get("villageId") ?? "");
            const role = String(formData.get("membershipRole") ?? "HEADMAN");
            const villageName = villages.find((village) => village.id === villageId)?.name ?? villageId;
            setDialogState({
              title: "ยืนยันแต่งตั้งบทบาทผู้บริหารหมู่บ้าน",
              description: `ต้องการแต่งตั้ง ${user.name} เป็น ${role} ของ ${villageName}`,
              tone: "default",
              action: async () => {
                router.push(`/superadmin/villages/${villageId}`);
                setDialogState(null);
              },
            });
          }}
        >
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
            <Button type="submit" className="bg-cyan-600 hover:bg-cyan-700 focus:ring-cyan-500">แต่งตั้ง</Button>
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
                <span>{membership.village.name} • {membership.role} • {membership.status}</span>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDialogState({
                      title: "ยืนยันถอดบทบาทผู้บริหาร",
                      description: `ต้องการถอด ${user.name} ออกจากบทบาท ${membership.role} ของ ${membership.village.name}`,
                      tone: "default",
                      action: async () => {
                        router.push(`/superadmin/villages/${membership.village.id}`);
                        setDialogState(null);
                      },
                    });
                  }}
                >
                  ถอดจากบทบาทผู้บริหาร
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(dialogState)}
        title={dialogState?.title ?? ""}
        description={dialogState?.description}
        tone={dialogState?.tone}
        pending={pending}
        onClose={() => !pending && setDialogState(null)}
        onConfirm={() => { void dialogState?.action(); }}
      />
    </div>
  );
}
