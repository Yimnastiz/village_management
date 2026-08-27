"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ActionReasonDialog } from "@/components/admin/action-reason-dialog";
import { useToast } from "@/components/ui/toast";
import { adminDeleteVillagePlaceAction } from "./actions";

export function DeletePlaceButton({ placeId, placeName }: { placeId: string; placeName: string }) {
  const router = useRouter(); const toast = useToast(); const [open, setOpen] = useState(false); const [pending, setPending] = useState(false);
  const onDelete = async (reason: string) => { setPending(true); try { const result = await adminDeleteVillagePlaceAction(placeId, reason); if (!result.success) { toast.error(result.error); return; } setOpen(false); toast.success("ลบสถานที่เรียบร้อยแล้ว"); router.replace("/admin/places"); } catch { toast.error("ไม่สามารถลบสถานที่ได้ กรุณาลองใหม่อีกครั้ง"); } finally { setPending(false); } };
  return <><Button variant="danger" onClick={() => setOpen(true)}>ลบสถานที่</Button><ActionReasonDialog open={open} action="content.delete" title="ลบสถานที่" description={`สถานที่ “${placeName}” จะถูกลบออกจากรายการและบันทึกเหตุผลใน Audit Log`} submitLabel="ลบสถานที่" loading={pending} onCancel={() => setOpen(false)} onSubmit={onDelete} /></>;
}
