"use client";

import { useState } from "react";
import { MembershipStatus, VillageMembershipRole } from "@prisma/client";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { MEMBERSHIP_ROLE_LABELS } from "@/lib/constants";
import { updateVillageMemberAccessAction } from "../actions";

type Member = { id: string; userId: string; name: string; phone: string; houseNumber: string | null; role: VillageMembershipRole; status: MembershipStatus };
type PendingChange = { member: Member; role: VillageMembershipRole; status: MembershipStatus } | null;
const roleOptions = Object.values(VillageMembershipRole).map((value) => ({ value, label: MEMBERSHIP_ROLE_LABELS[value] }));

export function AccessTable({ members, currentUserId }: { members: Member[]; currentUserId: string }) {
  const router = useRouter(); const toast = useToast(); const [draftRoles, setDraftRoles] = useState<Record<string, VillageMembershipRole>>({}); const [change, setChange] = useState<PendingChange>(null); const [reason, setReason] = useState(""); const [pending, setPending] = useState(false);
  async function confirm() { if (!change) return; setPending(true); const form = new FormData(); form.set("membershipId", change.member.id); form.set("role", change.role); form.set("status", change.status); if (reason.trim()) form.set("reason", reason.trim()); try { const result = await updateVillageMemberAccessAction(form); if (!result.success) { toast.error("ปรับสิทธิ์ผู้ใช้ไม่สำเร็จ", result.error); return; } const statusChanged = change.status !== change.member.status; toast.success(statusChanged ? (change.status === MembershipStatus.SUSPENDED ? "ระงับการใช้งานเรียบร้อยแล้ว" : "เปิดใช้งานผู้ใช้อีกครั้งเรียบร้อยแล้ว") : "เปลี่ยนบทบาทเรียบร้อยแล้ว"); setChange(null); setReason(""); router.refresh(); } catch { toast.error("ปรับสิทธิ์ผู้ใช้ไม่สำเร็จ"); } finally { setPending(false); } }
  return <>
    <div className="min-h-0 flex-1 overflow-auto"><table className="min-w-[780px] w-full text-left text-sm"><thead className="sticky top-0 z-10 bg-gray-50 text-gray-600 shadow-[0_1px_0_0_rgb(229,231,235)]"><tr><th className="px-4 py-3 font-medium">ผู้ใช้งาน</th><th className="px-4 py-3 font-medium">เบอร์โทร</th><th className="px-4 py-3 font-medium">บ้านเลขที่</th><th className="px-4 py-3 font-medium">บทบาท</th><th className="px-4 py-3 font-medium">สถานะ</th><th className="px-4 py-3 text-right font-medium">จัดการ</th></tr></thead><tbody className="divide-y divide-gray-100">{members.map((member) => { const role = draftRoles[member.id] ?? member.role; const self = member.userId === currentUserId; return <tr key={member.id} className="align-middle"><td className="px-4 py-3 font-medium text-gray-900">{member.name}{self ? <span className="ml-1 text-xs font-normal text-gray-400">(คุณ)</span> : null}</td><td className="px-4 py-3 text-gray-600">{member.phone}</td><td className="px-4 py-3 text-gray-600">{member.houseNumber ?? "-"}</td><td className="w-52 px-4 py-3"><Select aria-label={`บทบาทของ ${member.name}`} value={role} onChange={(event) => setDraftRoles((current) => ({ ...current, [member.id]: event.target.value as VillageMembershipRole }))} options={roleOptions} className="py-1.5" /></td><td className="px-4 py-3"><Badge variant={member.status === MembershipStatus.ACTIVE ? "success" : "warning"}>{member.status === MembershipStatus.ACTIVE ? "ใช้งานอยู่" : "ระงับการใช้งาน"}</Badge></td><td className="px-4 py-3"><div className="flex justify-end gap-2"><Button type="button" size="sm" variant="outline" disabled={role === member.role} onClick={() => setChange({ member, role, status: member.status })}>บันทึกบทบาท</Button><Button type="button" size="sm" variant={member.status === MembershipStatus.ACTIVE ? "danger" : "outline"} disabled={self} onClick={() => setChange({ member, role, status: member.status === MembershipStatus.ACTIVE ? MembershipStatus.SUSPENDED : MembershipStatus.ACTIVE })}>{member.status === MembershipStatus.ACTIVE ? "ระงับ" : "เปิดใช้งานอีกครั้ง"}</Button></div></td></tr>; })}</tbody></table></div>
    <ConfirmDialog open={Boolean(change)} title={change?.status !== change?.member.status ? (change?.status === MembershipStatus.SUSPENDED ? "ยืนยันการระงับผู้ใช้" : "ยืนยันการเปิดใช้งานอีกครั้ง") : "ยืนยันการเปลี่ยนบทบาท"} description={change ? `ผู้ใช้งาน: ${change.member.name}` : undefined} confirmLabel="ยืนยัน" tone={change?.status === MembershipStatus.SUSPENDED ? "danger" : "default"} pending={pending} onClose={() => { if (!pending) { setChange(null); setReason(""); } }} onConfirm={confirm}>{change?.status === MembershipStatus.SUSPENDED ? <Textarea label="เหตุผล (ไม่บังคับ)" value={reason} onChange={(event) => setReason(event.target.value)} rows={3} /> : null}</ConfirmDialog>
  </>;
}
