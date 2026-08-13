"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { adminDeleteVillagePlaceAction } from "./actions";

export function DeletePlaceButton({ placeId, placeName }: { placeId: string; placeName: string }) {
  const router = useRouter(); const toast = useToast(); const [open, setOpen] = useState(false); const [pending, setPending] = useState(false);
  const onDelete = async () => { setPending(true); const result = await adminDeleteVillagePlaceAction(placeId); setPending(false); if (!result.success) { toast.error(result.error); return; } setOpen(false); toast.success("ลบสถานที่เรียบร้อยแล้ว"); router.push("/admin/places"); router.refresh(); };
  return <><Button variant="danger" onClick={() => setOpen(true)}>ลบสถานที่</Button><ConfirmDialog open={open} onClose={() => !pending && setOpen(false)} onConfirm={onDelete} pending={pending} tone="danger" title="ลบสถานที่?" description={`สถานที่ “${placeName}” จะถูกลบออกจากรายการ`} confirmLabel="ลบสถานที่" /></>;
}
