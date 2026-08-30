"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { reviewBindingForWorkspaceAction, type BindingReviewActionState } from "./actions";

type HouseOption = { id: string; houseNumber: string };
type IdentityReconciliation = {
  kind: "no_match" | "single_unlinked_match" | "multiple_matches" | "linked_to_another_user" | "already_linked_to_applicant";
  person?: { name: string; nationalIdMasked: string; dateOfBirth: string | null; phone: string | null; houseNumber: string | null; source: string | null };
};
type Props = { villageName: string; requestId: string; proposed: boolean; houses: HouseOption[]; identityReconciliation?: IdentityReconciliation; applicantName: string; applicantPhone: string; applicantDateOfBirth: string | null; requestedHouseNumber: string | null };

export function BindingReviewForm({ villageName, requestId, proposed, houses, identityReconciliation, applicantName, applicantPhone, applicantDateOfBirth, requestedHouseNumber }: Props) {
  const [state, formAction, pending] = useActionState(reviewBindingForWorkspaceAction, { success: false } as BindingReviewActionState);
  const formRef = useRef<HTMLFormElement>(null);
  const [decision, setDecision] = useState<"APPROVE" | "REJECT" | null>(null);
  const [reviewReason, setReviewReason] = useState("");
  const [supportReason, setSupportReason] = useState("");
  const [confirmMatchedPerson, setConfirmMatchedPerson] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const identityBlocked = identityReconciliation?.kind === "multiple_matches" || identityReconciliation?.kind === "linked_to_another_user";
  const busy = pending || submitting;

  useEffect(() => {
    if (!state.message) return;
    setSubmitting(false);
    if (state.success) {
      toast.success(state.message);
      setDecision(null);
      setReviewReason("");
      setSupportReason("");
      setErrorMessage(null);
      router.refresh();
      return;
    }
    setErrorMessage(state.message);
    toast.error("ดำเนินการไม่สำเร็จ", state.message);
  }, [router, state.message, state.success, toast]);

  const submitDecision = () => {
    if (!decision || busy) return;
    const normalizedReviewReason = reviewReason.trim();
    const normalizedSupportReason = supportReason.trim();
    if (normalizedSupportReason.length < 5 || (decision === "REJECT" && normalizedReviewReason.length < 5)) return;
    const form = formRef.current;
    if (!form) return;
    const formData = new FormData(form);
    formData.set("decision", decision);
    formData.set("reviewReason", normalizedReviewReason);
    formData.set("supportReason", normalizedSupportReason);
    setErrorMessage(null);
    setSubmitting(true);
    startTransition(() => formAction(formData));
  };

  return <section className="mt-5 rounded-xl border border-gray-200 bg-white p-4 sm:p-5" aria-label={`ตรวจคำขอของ ${villageName}`}>
    <div><h2 className="font-semibold text-gray-900">ดำเนินการคำขอ</h2><p className="mt-1 text-sm text-gray-500">ตรวจสอบข้อมูลให้ครบถ้วนก่อนเลือกผลการพิจารณา</p></div>
    <form ref={formRef} className="mt-4 space-y-3">
      <input type="hidden" name="requestId" value={requestId} />
      {identityReconciliation?.kind === "single_unlinked_match" && confirmMatchedPerson ? <input type="hidden" name="confirmMatchedPerson" value="true" /> : null}
      {identityReconciliation?.kind === "single_unlinked_match" && identityReconciliation.person ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"><p className="font-semibold">พบบุคคลในทะเบียนที่ตรงกับผู้สมัคร</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><div><p className="text-emerald-800">ผู้สมัคร</p><p className="mt-1 font-medium">{applicantName}</p><p>{applicantPhone}</p><p>วันเกิด: {applicantDateOfBirth ?? "-"}</p></div><div><p className="text-emerald-800">ข้อมูลในทะเบียน</p><p className="mt-1 font-medium">{identityReconciliation.person.name}</p><p>บัตร: {identityReconciliation.person.nationalIdMasked}</p><p>วันเกิด: {identityReconciliation.person.dateOfBirth ?? "-"}</p><p>ติดต่อ: {identityReconciliation.person.phone ?? "-"}</p><p>บ้านปัจจุบัน: {identityReconciliation.person.houseNumber ?? "-"}</p><p>แหล่งข้อมูล: {identityReconciliation.person.source ?? "-"}</p></div></div><p className="mt-3">บ้านที่ขอ: {requestedHouseNumber ?? "-"}</p><label className="mt-3 flex items-start gap-2 font-medium"><input type="checkbox" checked={confirmMatchedPerson} onChange={(event) => setConfirmMatchedPerson(event.target.checked)} className="mt-0.5 size-4" />ยืนยันการใช้ข้อมูลบุคคลในทะเบียนนี้และผูกกับผู้สมัคร</label></div> : null}
      {identityReconciliation?.kind === "single_unlinked_match" && identityReconciliation.person?.houseNumber && requestedHouseNumber && identityReconciliation.person.houseNumber !== requestedHouseNumber ? <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">บ้านในทะเบียน ({identityReconciliation.person.houseNumber}) ไม่ตรงกับบ้านที่ขอ ({requestedHouseNumber}) การอนุมัติจะย้ายทะเบียนบุคคลตามคำขอ และต้องระบุเหตุผลการสนับสนุน</div> : null}
      {identityReconciliation?.kind === "multiple_matches" ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-950">พบบุคคลซ้ำในทะเบียน โปรดตรวจสอบข้อมูลประชากรก่อนดำเนินการต่อ ระบบจึงไม่อนุญาตให้อนุมัติคำขอนี้</div> : null}
      {identityReconciliation?.kind === "linked_to_another_user" ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-950">บุคคลที่ตรงกันถูกผูกกับบัญชีอื่นแล้ว จึงไม่สามารถผูกทับได้และไม่อนุญาตให้อนุมัติ</div> : null}
      {proposed ? <label className="block text-sm font-medium text-gray-700">จับคู่บ้านในทะเบียนก่อนอนุมัติ<select name="selectedHouseId" defaultValue="" className="mt-1.5 min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"><option value="">ยังไม่ได้จับคู่บ้าน</option>{houses.map((house) => <option key={house.id} value={house.id}>{house.houseNumber}</option>)}</select></label> : null}
    </form>
    {errorMessage ? <p className="mt-3 text-sm font-medium text-rose-700" role="alert">{errorMessage}</p> : null}
    <div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={busy || identityBlocked || (identityReconciliation?.kind === "single_unlinked_match" && !confirmMatchedPerson)} onClick={() => setDecision("APPROVE")} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald-700 px-4 text-sm font-medium text-white transition-colors hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">อนุมัติ</button><button type="button" disabled={busy} onClick={() => setDecision("REJECT")} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-rose-700 px-4 text-sm font-medium text-white transition-colors hover:bg-rose-800 focus:outline-none focus:ring-2 focus:ring-rose-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">ปฏิเสธ</button></div>
    <Dialog open={decision !== null} title={decision === "APPROVE" ? "อนุมัติคำขอผูกบ้าน" : "ปฏิเสธคำขอผูกบ้าน"} description={decision === "APPROVE" ? "ระบุเหตุผลที่ Super Admin ดำเนินการแทนผู้ดูแลหมู่บ้าน" : "ระบุเหตุผลแยกตามผู้รับสาร เพื่อให้ผู้ยื่นคำขอและผู้ดูแลหมู่บ้านเข้าใจตรงกัน"} onClose={() => { if (!busy) { setDecision(null); setErrorMessage(null); setReviewReason(""); setSupportReason(""); } }} closeOnBackdrop={false} closeOnEscape={!busy} footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" disabled={busy} onClick={() => { setDecision(null); setErrorMessage(null); setReviewReason(""); setSupportReason(""); }}>ยกเลิก</Button><Button type="button" isLoading={busy} disabled={busy || supportReason.trim().length < 5 || (decision === "REJECT" && reviewReason.trim().length < 5)} onClick={submitDecision}>{decision === "APPROVE" ? "ยืนยันการอนุมัติ" : "ยืนยันการปฏิเสธ"}</Button></div>}>
      <div className="space-y-4">
        {decision === "REJECT" ? <Textarea label="เหตุผลที่ปฏิเสธคำขอ" required value={reviewReason} onChange={(event) => setReviewReason(event.target.value)} helperText="เหตุผลนี้จะแสดงต่อผู้ยื่นคำขอและบันทึกเป็นหมายเหตุการพิจารณา อย่างน้อย 5 ตัวอักษร" minLength={5} disabled={busy} /> : null}
        <Textarea label="เหตุผลในการดำเนินการแทนผู้ดูแลหมู่บ้าน" required value={supportReason} onChange={(event) => setSupportReason(event.target.value)} helperText="เหตุผลนี้ใช้ในบันทึกการตรวจสอบและการแจ้งเตือนผู้ดูแลหมู่บ้าน อย่างน้อย 5 ตัวอักษร" minLength={5} disabled={busy} />
        {errorMessage ? <p className="text-sm font-medium text-rose-700" role="alert">{errorMessage}</p> : null}
      </div>
    </Dialog>
  </section>;
}
