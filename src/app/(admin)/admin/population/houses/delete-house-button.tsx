"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { deleteHouseAction } from "./actions";

export function DeleteHouseButton({ houseId, houseNumber }: { houseId: string; houseNumber: string }) {
  const [open, setOpen] = useState(false); const [reason, setReason] = useState(""); const [pending, startTransition] = useTransition(); const router = useRouter(); const toast = useToast();
  return <><Button type="button" variant="danger" onClick={() => setOpen(true)}>ลบบ้าน</Button>{open ? <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true"><div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"><h2 className="text-lg font-semibold">ลบบ้านเลขที่ {houseNumber}</h2><p className="mt-2 text-sm text-slate-600">การลบทำได้เฉพาะบ้านที่ยังไม่มีประชากรหรือสมาชิกผูกอยู่ การดำเนินการนี้ไม่สามารถย้อนกลับได้</p><label className="mt-4 block text-sm font-medium">เหตุผล <span className="text-rose-600">*</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm" /></label><div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>ยกเลิก</Button><Button variant="danger" disabled={reason.trim().length < 3} isLoading={pending} onClick={() => startTransition(async()=>{const result=await deleteHouseAction(houseId,reason);if(!result.success){toast.error("ไม่สามารถลบบ้านได้",result.error);return;}toast.success("ลบบ้านสำเร็จ");router.push("/admin/population/houses");router.refresh();})}>ลบบ้าน</Button></div></div></div> : null}</>;
}
