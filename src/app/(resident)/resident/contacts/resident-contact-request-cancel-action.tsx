"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { cancelResidentContactRequestAction } from "./actions";

export function ResidentContactRequestCancelAction({ requestId, requestType }: { requestId: string; requestType: "CREATE" | "UPDATE" | "DELETE" }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const description = requestType === "CREATE" ? "คำขอนี้ยังไม่ได้รับการอนุมัติและจะไม่ถูกเพิ่มเข้ารายชื่อผู้ติดต่อ" : "คุณต้องการยกเลิกคำขอนี้หรือไม่";
  async function cancel() {
    setPending(true);
    let result;
    try {
      result = await cancelResidentContactRequestAction(requestId);
    } catch {
      toast.error("ยกเลิกคำขอไม่สำเร็จ", "ไม่สามารถยกเลิกคำขอได้ กรุณาลองใหม่อีกครั้ง");
      setPending(false);
      return;
    }
    if (!result.success) {
      toast.error("ยกเลิกคำขอไม่สำเร็จ", result.error);
      setPending(false);
      return;
    }
    toast.success("ยกเลิกคำขอเรียบร้อยแล้ว");
    setOpen(false);
    setPending(false);
    try { router.refresh(); } catch (error) { console.error("Contact request cancellation succeeded but refresh failed", error); }
  }
  return <><Button type="button" variant="danger" onClick={() => setOpen(true)}>ยกเลิกคำขอ</Button><ConfirmDialog open={open} title="ยกเลิกคำขอ" description={description} cancelLabel="ไม่ยกเลิก" confirmLabel="ยืนยันยกเลิกคำขอ" tone="danger" pending={pending} onClose={() => setOpen(false)} onConfirm={cancel} /></>;
}
