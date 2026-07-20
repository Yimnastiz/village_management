"use client";

import { useFormStatus } from "react-dom";
import { confirmPopulationImportAction } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{pending ? "กำลังยืนยัน..." : "ยืนยันนำเข้าข้อมูล"}</button>;
}

export function ImportConfirmForm({ jobId }: { jobId: string }) {
  return <form action={confirmPopulationImportAction} onSubmit={(event) => { if (!window.confirm("ยืนยันการนำเข้าข้อมูลตาม Preview นี้หรือไม่?")) event.preventDefault(); }} className="mt-4 flex flex-col gap-3 md:flex-row md:items-end"><input type="hidden" name="jobId" value={jobId} /><label className="flex-1 text-sm font-medium text-amber-950">เหตุผลการยืนยัน<input required minLength={5} name="supportReason" className="mt-1 block w-full rounded-lg border border-amber-300 bg-white px-3 py-2" placeholder="เช่น ตรวจสอบกับทะเบียนบ้านแล้ว" /></label><SubmitButton /></form>;
}
