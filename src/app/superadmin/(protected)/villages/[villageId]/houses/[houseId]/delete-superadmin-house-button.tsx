"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ActionReasonDialog } from "@/components/admin/action-reason-dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { deleteSuperAdminHouseAction } from "../../population-actions";

export function DeleteSuperAdminHouseButton({ villageId, houseId, houseNumber }: { villageId: string; houseId: string; houseNumber: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  const remove = (reason: string) => startTransition(async () => {
    const result = await deleteSuperAdminHouseAction(villageId, houseId, reason);
    if (!result.success) {
      toast.error("ไม่สามารถลบบ้านได้", result.error);
      return;
    }
    setOpen(false);
    toast.success(result.message);
    router.push(`/superadmin/villages/${villageId}/houses`);
    router.refresh();
  });

  return <>
    <Button type="button" variant="danger" onClick={() => setOpen(true)}>ลบบ้าน</Button>
    <ActionReasonDialog open={open} action="population.house.delete" title={`ลบบ้านเลขที่ ${houseNumber}`} description="ลบได้เฉพาะบ้านที่ไม่มีประชากร สมาชิกผูกบ้าน หรือประวัติที่เกี่ยวข้อง เหตุผลจะถูกบันทึกใน Audit Log" reasonLabel="เหตุผลในการดำเนินการ *" submitLabel="ยืนยันลบบ้าน" loading={pending} onCancel={() => setOpen(false)} onSubmit={remove} />
  </>;
}
