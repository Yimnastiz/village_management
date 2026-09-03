import Link from "next/link";
import { MEMBERSHIP_ROLE_LABELS, MEMBERSHIP_STATUS_LABELS } from "@/lib/constants";

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
  accountStatus: string;
  registrationProvince: string | null;
  registrationDistrict: string | null;
  registrationSubdistrict: string | null;
  registrationVillage: { name: string } | null;
  memberships: MembershipRow[];
};

const ACCOUNT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "ใช้งานอยู่",
  SUSPENDED: "ระงับการใช้งาน",
  PENDING: "รอตรวจสอบ",
  DELETION_PENDING: "รอปิดบัญชี",
  ANONYMIZED: "ปิดบัญชีแล้ว",
  DUPLICATE_ID: "ข้อมูลซ้ำ",
};

function membershipStatusClass(status: string) {
  return status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700";
}

function accountStatusClass(status: string) {
  if (status === "ACTIVE") return "bg-emerald-50 text-emerald-700";
  if (status === "SUSPENDED" || status === "ANONYMIZED") return "bg-red-50 text-red-700";
  if (status === "PENDING" || status === "DELETION_PENDING") return "bg-amber-50 text-amber-700";
  return "bg-gray-100 text-gray-700";
}

export function UserManagementCard({ user }: { user: UserRow; villages?: { id: string; name: string }[] }) {
  return (
    <article className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-col gap-2.5 px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div className="min-w-0">
          <h2 className="break-words text-base font-semibold text-gray-900 sm:text-lg">{user.name}</h2>
          <p className="mt-1 text-sm text-gray-600">{user.phoneNumber}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${accountStatusClass(user.accountStatus)}`}>{ACCOUNT_STATUS_LABELS[user.accountStatus] ?? "ไม่ทราบสถานะ"}</span>
        </div>
      </div>

      <div className="grid gap-3 border-t border-gray-100 px-4 py-3 sm:px-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <section aria-labelledby={`registration-${user.id}`} className="min-w-0">
          <p id={`registration-${user.id}`} className="text-xs font-medium text-gray-400">พื้นที่ที่ระบุตอนสมัคร</p>
          {user.registrationVillage || user.registrationSubdistrict || user.registrationDistrict || user.registrationProvince ? <><p className="mt-1 break-words text-sm text-gray-600">{user.registrationVillage?.name ?? "ไม่ระบุหมู่บ้าน"}</p><p className="mt-0.5 break-words text-xs text-gray-400">ต.{user.registrationSubdistrict ?? "-"} อ.{user.registrationDistrict ?? "-"} จ.{user.registrationProvince ?? "-"}</p></> : <p className="mt-1 text-sm text-gray-400">ไม่ระบุพื้นที่</p>}
        </section>

        <section aria-labelledby={`memberships-${user.id}`}>
          <div className="flex items-center justify-between gap-2">
            <p id={`memberships-${user.id}`} className="text-xs font-medium text-gray-500">หมู่บ้านที่สังกัดจริง</p>
            {user.memberships.length > 0 ? <span className="text-xs text-gray-400">{user.memberships.length} แห่ง</span> : null}
          </div>
          {user.memberships.length === 0 ? <p className="mt-1 text-sm text-gray-500">ยังไม่มีหมู่บ้านที่สังกัด</p> : <div className="mt-2 space-y-1.5">
            {user.memberships.map((membership) => <div key={membership.id} className="flex flex-col gap-1.5 rounded-md bg-gray-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="break-words text-sm font-medium text-gray-800">{membership.village.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                  <span>{MEMBERSHIP_ROLE_LABELS[membership.role] ?? "สมาชิกหมู่บ้าน"}</span><span aria-hidden="true">·</span>
                  <span className={`rounded-full px-2 py-0.5 font-medium ${membershipStatusClass(membership.status)}`}>{MEMBERSHIP_STATUS_LABELS[membership.status] ?? "ไม่ทราบสถานะ"}</span>
                  {membership.house ? <><span aria-hidden="true">·</span><span>บ้านเลขที่ {membership.house.houseNumber}</span></> : null}
                </div>
              </div>
              <Link href={`/superadmin/villages/${membership.village.id}/users`} className="inline-flex min-h-8 shrink-0 items-center justify-center rounded-md px-2 text-xs font-medium text-gray-500 transition-colors hover:bg-white hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2">จัดการในหมู่บ้าน</Link>
            </div>)}
          </div>}
        </section>
      </div>

      <div className="flex justify-end border-t border-gray-100 px-4 py-2.5 sm:px-5">
        <Link href={`/superadmin/users/${user.id}`} className="inline-flex min-h-10 items-center justify-center rounded-lg bg-cyan-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2">ดูรายละเอียด</Link>
      </div>
    </article>
  );
}
