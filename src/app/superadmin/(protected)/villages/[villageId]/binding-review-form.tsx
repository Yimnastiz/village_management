"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { BindingReviewActionState } from "./actions";

type HouseOption = { id: string; houseNumber: string };
type IdentityReconciliation = { kind: "no_match" | "single_unlinked_match" | "multiple_matches" | "linked_to_another_user" | "already_linked_to_applicant"; person?: { name: string; nationalIdMasked: string; dateOfBirth: string | null; phone: string | null; houseNumber: string | null; source: string | null } };
type Props = { villageName: string; requestId: string; proposed: boolean; houses: HouseOption[]; reviewAction: (previousState: BindingReviewActionState, formData: FormData) => Promise<BindingReviewActionState>; identityReconciliation?: IdentityReconciliation; applicantName: string; applicantPhone: string; applicantDateOfBirth: string | null; requestedHouseNumber: string | null };

export function BindingReviewForm({ villageName, requestId, proposed, houses, reviewAction, identityReconciliation, applicantName, applicantPhone, applicantDateOfBirth, requestedHouseNumber }: Props) {
  const [state, formAction, pending] = useActionState(reviewAction, { success: false } as BindingReviewActionState);
  const ref = useRef<HTMLFormElement>(null);
  const [decision, setDecision] = useState<"APPROVE" | "REJECT" | null>(null);
  const [confirmMatchedPerson, setConfirmMatchedPerson] = useState(false);
  const toast = useToast();
  const identityBlocked = identityReconciliation?.kind === "multiple_matches" || identityReconciliation?.kind === "linked_to_another_user";

  useEffect(() => {
    if (!state.message) return;
    if (state.success) { ref.current?.reset(); toast.success(state.message); }
    else toast.error("ดำเนินการไม่สำเร็จ", state.message);
  }, [state.success, state.message, toast]);

  return <form ref={ref} action={formAction} className="mt-4 space-y-3" aria-label={`ตรวจคำขอของ ${villageName}`}>
    <input type="hidden" name="requestId" value={requestId} /><input type="hidden" name="decision" value={decision ?? ""} />
    {identityReconciliation?.kind === "single_unlinked_match" && confirmMatchedPerson ? <input type="hidden" name="confirmMatchedPerson" value="true" /> : null}
    {identityReconciliation?.kind === "single_unlinked_match" && identityReconciliation.person ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"><p className="font-semibold">พบข้อมูลบุคคลในทะเบียนที่ตรงกับผู้สมัคร</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><div><p className="text-emerald-800">ผู้สมัคร</p><p className="mt-1 font-medium">{applicantName}</p><p>{applicantPhone}</p><p>วันเกิด: {applicantDateOfBirth ?? "-"}</p></div><div><p className="text-emerald-800">ข้อมูลในทะเบียน</p><p className="mt-1 font-medium">{identityReconciliation.person.name}</p><p>บัตร: {identityReconciliation.person.nationalIdMasked}</p><p>วันเกิด: {identityReconciliation.person.dateOfBirth ?? "-"}</p><p>ติดต่อ: {identityReconciliation.person.phone ?? "-"}</p><p>บ้านปัจจุบัน: {identityReconciliation.person.houseNumber ?? "-"}</p><p>แหล่งข้อมูล: {identityReconciliation.person.source ?? "-"}</p></div></div><p className="mt-3">บ้านที่ขอ: {requestedHouseNumber ?? "-"}</p><label className="mt-3 flex items-start gap-2 font-medium"><input type="checkbox" checked={confirmMatchedPerson} onChange={(event) => setConfirmMatchedPerson(event.target.checked)} className="mt-0.5 size-4" />ยืนยันใช้ข้อมูลบุคคลในทะเบียนนี้และผูกกับผู้สมัคร</label></div> : null}
    {identityReconciliation?.kind === "single_unlinked_match" && identityReconciliation.person?.houseNumber && requestedHouseNumber && identityReconciliation.person.houseNumber !== requestedHouseNumber ? <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">บ้านในทะเบียน ({identityReconciliation.person.houseNumber}) ไม่ตรงกับบ้านที่ขอ ({requestedHouseNumber}) การอนุมัติจะย้ายทะเบียนบุคคลตามคำขอและต้องระบุเหตุผลการสนับสนุน</div> : null}
    {identityReconciliation?.kind === "multiple_matches" ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-950">พบข้อมูลบุคคลซ้ำในทะเบียน กรุณาตรวจสอบข้อมูลประชากรก่อนดำเนินการต่อ</div> : null}
    {identityReconciliation?.kind === "linked_to_another_user" ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-950">ข้อมูลบุคคลที่ตรงกันถูกผูกกับบัญชีอื่นแล้ว ไม่สามารถผูกทับได้</div> : null}
    {proposed ? <label className="block text-sm text-slate-600">จับคู่บ้านในทะเบียนก่อนอนุมัติ<select name="selectedHouseId" defaultValue="" className="mt-1 min-h-10 w-full rounded-lg border bg-white px-3"><option value="">ยังไม่จับคู่บ้าน</option>{houses.map((house) => <option key={house.id} value={house.id}>{house.houseNumber}</option>)}</select></label> : null}
    <div className="flex flex-col gap-2 sm:flex-row"><input name="reason" required minLength={5} placeholder="เหตุผลการดำเนินการ (อย่างน้อย 5 ตัวอักษร)" className="min-h-10 min-w-0 flex-1 rounded-lg border px-3 text-sm" /><div className="flex gap-2"><button type="button" disabled={pending || identityBlocked || (identityReconciliation?.kind === "single_unlinked_match" && !confirmMatchedPerson)} onClick={() => setDecision("APPROVE")} className="min-h-10 rounded-lg bg-emerald-700 px-3 text-sm font-medium text-white disabled:opacity-50">อนุมัติ</button><button type="button" disabled={pending} onClick={() => setDecision("REJECT")} className="min-h-10 rounded-lg bg-rose-700 px-3 text-sm font-medium text-white disabled:opacity-50">ปฏิเสธ</button></div></div>
    <ConfirmDialog open={decision !== null} title={decision === "APPROVE" ? "ยืนยันอนุมัติคำขอ" : "ยืนยันปฏิเสธคำขอ"} description={decision === "APPROVE" ? "บัญชีผู้ยื่นจะถูกผูกกับบ้านที่ตรวจสอบแล้วในหมู่บ้านนี้" : "คำขอจะถูกปฏิเสธและผู้ยื่นจะได้รับแจ้งเหตุผล"} confirmLabel={decision === "APPROVE" ? "ยืนยันอนุมัติ" : "ยืนยันปฏิเสธ"} tone={decision === "REJECT" ? "danger" : "default"} pending={pending} onClose={() => setDecision(null)} onConfirm={() => { const form = ref.current; if (!form?.reportValidity()) return; form.requestSubmit(); setDecision(null); }} />
  </form>;
}
