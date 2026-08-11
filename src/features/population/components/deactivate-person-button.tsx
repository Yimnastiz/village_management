"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

export function DeactivatePersonButton({ action }: { action: (reason:string)=>Promise<{success:true;message:string}|{success:false;error:string}> }) {
 const [open,setOpen]=useState(false); const [reason,setReason]=useState(""); const [pending,startTransition]=useTransition(); const toast=useToast();
 return <><Button variant="dangerOutline" onClick={()=>setOpen(true)}>ยกเลิกข้อมูล</Button>{open?<div className="fixed inset-0 z-[89] flex items-center justify-center bg-slate-950/50 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-5"><h2 className="text-lg font-semibold">ยกเลิกข้อมูลประชากร</h2><p className="mt-2 text-sm text-slate-600">บุคคลจะถูกปรับสถานะเป็นย้ายออกและบันทึกประวัติการเคลื่อนไหว</p><div className="mt-4"><Input label="เหตุผล" value={reason} onChange={e=>setReason(e.target.value)} minLength={5} required/></div><div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="outline" disabled={pending} onClick={()=>setOpen(false)}>ยกเลิก</Button><Button variant="danger" isLoading={pending} disabled={reason.trim().length<5} onClick={()=>startTransition(async()=>{const r=await action(reason);if(r.success){toast.success(r.message);setOpen(false);}else toast.error("ยกเลิกข้อมูลไม่สำเร็จ",r.error);})}>ยืนยันยกเลิกข้อมูล</Button></div></div></div>:null}</>;
}
