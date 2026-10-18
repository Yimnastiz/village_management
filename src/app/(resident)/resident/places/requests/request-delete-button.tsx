"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ActionReasonDialog } from "@/components/admin/action-reason-dialog";
import { useToast } from "@/components/ui/toast";
import { createVillagePlaceDeleteSubmissionAction } from "./actions";
export function PlaceDeleteRequestButton({ placeId, placeName }: { placeId: string; placeName: string }) {
  const [open, setOpen] = useState(false); const [pending, setPending] = useState(false); const router = useRouter(); const toast = useToast();
  const submit = async (reason: string) => { setPending(true); try { const result = await createVillagePlaceDeleteSubmissionAction(placeId, reason); if (!result.success) return toast.error(result.error); toast.success("ส่งคำขอลบสถานที่เรียบร้อยแล้ว"); setOpen(false); router.push(`/resident/places/requests/${result.requestId}`); } finally { setPending(false); } };
  return <><Button type="button" variant="danger" size="sm" onClick={() => setOpen(true)}>ขอลบ</Button><ActionReasonDialog open={open} action="content.delete" title="ขอลบสถานที่" description={`ระบุเหตุผลที่ต้องการให้ผู้ใหญ่บ้านพิจารณาลบ “${placeName}” สถานที่จะยังไม่ถูกลบจนกว่าคำขอได้รับอนุมัติ`} submitLabel="ส่งคำขอลบ" loading={pending} onCancel={() => setOpen(false)} onSubmit={submit} /></>;
}
