"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ActionReasonDialog } from "@/components/admin/action-reason-dialog";
import { useToast } from "@/components/ui/toast";
import { superAdminDeletePlaceDataAction } from "../public-content-actions";
export function SuperAdminDeletePlaceButton({ villageId, placeId, placeName }: { villageId: string; placeId: string; placeName: string }) { const router=useRouter(); const toast=useToast(); const [open,setOpen]=useState(false); const [pending,setPending]=useState(false); const run=async(reason:string)=>{setPending(true);const result=await superAdminDeletePlaceDataAction(villageId,placeId,reason);setPending(false);if(!result.success){toast.error(result.error);return;}toast.success("ลบสถานที่แล้ว");router.replace(`/superadmin/villages/${villageId}/places`)};return <><Button variant="dangerOutline" size="sm" onClick={()=>setOpen(true)}>ลบ</Button><ActionReasonDialog open={open} action="content.delete" title="ลบสถานที่" description={`สถานที่ “${placeName}” จะถูกลบออกจากรายการ`} reasonLabel="เหตุผลในการดำเนินการ" helperText="ระบุเหตุผลที่ผู้ดูแลระบบระดับสูงดำเนินการแทนผู้ดูแลหมู่บ้าน" requireReason minReasonLength={5} maxReasonLength={500} loading={pending} onCancel={()=>setOpen(false)} onSubmit={run}/></> }
