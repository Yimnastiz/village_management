"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ActionReasonDialog } from "@/components/admin/action-reason-dialog";
import { useToast } from "@/components/ui/toast";
import { deleteHouseAction } from "./actions";

export function DeleteHouseButton({ houseId, houseNumber }: { houseId: string; houseNumber: string }) {
  const [open, setOpen] = useState(false); const [pending, startTransition] = useTransition(); const router = useRouter(); const toast = useToast();
  const remove = async (reason: string) => { startTransition(async () => { const result = await deleteHouseAction(houseId, reason); if (!result.success) { toast.error("ไม่สามารถลบบ้านได้", result.error); return; } setOpen(false); toast.success("ลบบ้านสำเร็จ"); router.push("/admin/population/houses"); router.refresh(); }); };
  return <><Button type="button" variant="danger" onClick={() => setOpen(true)}>ลบบ้าน</Button><ActionReasonDialog open={open} action="population.house.delete" title={`ลบบ้านเลขที่ ${houseNumber}`} description="ลบได้เฉพาะบ้านที่ไม่มีประชากรหรือสมาชิกผูกอยู่ และเหตุผลจะถูกบันทึกใน Audit Log" submitLabel="ลบบ้าน" loading={pending} onCancel={() => setOpen(false)} onSubmit={remove} /></>;
}
