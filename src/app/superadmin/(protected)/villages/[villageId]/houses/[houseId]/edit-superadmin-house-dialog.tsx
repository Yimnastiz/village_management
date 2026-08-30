"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { HouseForm } from "@/features/population/components/house-form";
import { updateSuperAdminHouseAction } from "../../population-actions";

export function EditSuperAdminHouseDialog({ villageId, houseId, houseNumber, address }: { villageId: string; houseId: string; houseNumber: string; address: string }) {
  const [open, setOpen] = useState(false);
  return <>
    <Button type="button" variant="outline" onClick={() => setOpen(true)}>แก้ไข</Button>
    <Dialog open={open} title="แก้ไขข้อมูลบ้าน" description="ปรับปรุงบ้านเลขที่หรือที่อยู่เพิ่มเติม แล้วระบุเหตุผลก่อนยืนยันการบันทึก" onClose={() => setOpen(false)} closeOnBackdrop={false} closeOnEscape={false}>
      <HouseForm mode="edit" action={updateSuperAdminHouseAction.bind(null, villageId, houseId)} defaults={{ houseNumber, address }} requireReason confirmReason onSuccess={() => setOpen(false)} />
    </Dialog>
  </>;
}
