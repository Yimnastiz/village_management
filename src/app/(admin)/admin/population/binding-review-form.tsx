"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

type State = { success: boolean; message?: string };
type Action = (previousState: State, formData: FormData) => Promise<State>;
type HouseOption = { id: string; houseNumber: string; villageId: string };

function SubmitButton({ label, value, danger = false, disabled = false }: { label: string; value: string; danger?: boolean; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return <button type="submit" name="action" value={value} disabled={pending || disabled} className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 ${danger ? "bg-red-600" : "bg-green-600"}`}>{pending ? "กำลังดำเนินการ..." : label}</button>;
}

function VerifyButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="mt-2 rounded-lg bg-amber-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">{pending ? "กำลังตรวจสอบ..." : "ยืนยันและสร้าง/จับคู่บ้าน"}</button>;
}

export function BindingReviewForm({ reviewAction, verifyAction, requestId, houseId, houseNumber, villageId, houses, personHouseNumber, personNationalId, houseMismatch, nationalIdClaimed = false }: { reviewAction: Action; verifyAction: Action; requestId: string; houseId: string | null; houseNumber: string | null; villageId: string; houses: HouseOption[]; personHouseNumber?: string | null; personNationalId?: string | null; houseMismatch?: boolean; nationalIdClaimed?: boolean }) {
  const [reviewState, reviewFormAction] = useActionState(reviewAction, { success: false });
  const [verifyState, verifyFormAction] = useActionState(verifyAction, { success: false });
  const isProposed = !houseId;
  const villageHouses = houses.filter((house) => house.villageId === villageId);
  return <div className="mt-4 space-y-3">
    {personNationalId ? <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">พบข้อมูลทะเบียนประชากร เลขบัตร {personNationalId}{personHouseNumber ? ` บ้านเลขที่ ${personHouseNumber}` : ""}</p> : null}
    {houseMismatch ? <label className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900"><input type="checkbox" name="confirmPersonHouseChange" value="true" className="mt-1" />ยืนยันว่าต้องการแก้ไขบ้านของข้อมูลทะเบียนประชากรให้ตรงกับคำขอนี้</label> : null}
    {isProposed ? <form action={verifyFormAction} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
      <input type="hidden" name="requestId" value={requestId} />
      <p className="mb-2 text-sm font-medium text-amber-900">เลขบ้าน {houseNumber ?? "ไม่ได้ระบุ"} ยังไม่อยู่ในทะเบียนบ้าน ต้องสร้างหรือจับคู่ก่อนอนุมัติ</p>
      <div className="grid gap-2 md:grid-cols-2"><select name="selectedHouseId" defaultValue="" className="rounded-lg border border-amber-300 bg-white p-2 text-sm"><option value="">สร้างบ้านใหม่จากคำขอที่ตรวจสอบแล้ว</option>{villageHouses.map((house) => <option key={house.id} value={house.id}>จับคู่บ้านเลขที่ {house.houseNumber}</option>)}</select><input name="sourceNote" required minLength={5} placeholder="เหตุผล/แหล่งที่มา อย่างน้อย 5 ตัวอักษร" className="rounded-lg border border-amber-300 bg-white p-2 text-sm" /></div>
      <VerifyButton />
      {verifyState.message ? <p role="alert" className={`mt-2 text-sm ${verifyState.success ? "text-green-700" : "text-red-700"}`}>{verifyState.message}</p> : null}
    </form> : null}
    <form action={reviewFormAction} className="space-y-2" onSubmit={(event) => { if (!window.confirm("ยืนยันการดำเนินการคำขอนี้หรือไม่?")) event.preventDefault(); }}>
      <input type="hidden" name="requestId" value={requestId} />
      <textarea name="reviewNote" required minLength={5} placeholder="เหตุผลการอนุมัติ/ปฏิเสธ อย่างน้อย 5 ตัวอักษร" className="w-full rounded-lg border border-gray-200 p-2 text-sm" rows={2} />
      <div className="flex gap-2"><SubmitButton label="อนุมัติ" value="approve" disabled={nationalIdClaimed} /><SubmitButton label="ปฏิเสธ" value="reject" danger /></div>
      {reviewState.message ? <p role="alert" className={`text-sm ${reviewState.success ? "text-green-700" : "text-red-700"}`}>{reviewState.message}</p> : null}
    </form>
  </div>;
}
