"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ActionReasonDialog } from "@/components/admin/action-reason-dialog";
import { useToast } from "@/components/ui/toast";
import { superAdminDeleteContactDataAction } from "../public-content-actions";
export function SuperAdminContactDelete({ villageId, contactId, name }: { villageId: string; contactId: string; name: string }) { const [open,setOpen]=useState(false),[busy,setBusy]=useState(false); const router=useRouter(),toast=useToast(); const run=async(reason:string)=>{setBusy(true);const r=await superAdminDeleteContactDataAction(villageId,contactId,reason);setBusy(false);if(!r.success){toast.error(r.error);return;}setOpen(false);router.refresh();}; return <><Button size="sm" variant="danger" onClick={()=>setOpen(true)}>ลบ</Button><ActionReasonDialog open={open} action="content.delete" title={`ลบผู้ติดต่อ “${name}”`} description="ระบบจะบันทึก Audit Log และแจ้งผู้ดูแลหมู่บ้าน" reasonLabel="เหตุผลในการดำเนินการ" helperText="ระบุเหตุผลที่ผู้ดูแลระบบระดับสูงดำเนินการแทนผู้ดูแลหมู่บ้าน" requireReason minReasonLength={5} maxReasonLength={500} loading={busy} onCancel={()=>setOpen(false)} onSubmit={run}/></>; }
