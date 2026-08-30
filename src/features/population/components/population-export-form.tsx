"use client";

import { useMemo, useState } from "react";
import { FormInfoPopover } from "@/components/ui/form-info-popover";
import { ExportDownload } from "./export-download";

export function PopulationExportForm({ canExportFullRegistry, endpoint = "/api/admin/population/export", reasonParam = "reason" }: { canExportFullRegistry: boolean; endpoint?: string; reasonParam?: string }) {
  const [sheets, setSheets] = useState("houses,people,accounts");
  const [masked, setMasked] = useState(!canExportFullRegistry);
  const [activeOnly, setActiveOnly] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const href = useMemo(() => {
    const params = new URLSearchParams({ sheets, masked: masked ? "true" : "false" });
    if (activeOnly) params.set("activeOnly", "true");
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return `${endpoint}?${params.toString()}`;
  }, [activeOnly, endpoint, from, masked, sheets, to]);

  const controlClassName = "h-10 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition hover:border-slate-400 focus:border-green-600 focus:bg-white focus:ring-4 focus:ring-green-500/10";

  return <div className="grid w-full gap-3 sm:grid-cols-2 xl:grid-cols-3">
    <label className="grid gap-1.5"><span className="text-xs font-medium text-slate-600">ชุดข้อมูล</span><select value={sheets} onChange={(event) => setSheets(event.target.value)} className={controlClassName} aria-label="ชุดข้อมูลที่ส่งออก"><option value="houses,people,accounts">บ้าน บุคคล และบัญชี</option><option value="houses">เฉพาะบ้าน</option><option value="people">เฉพาะบุคคล</option><option value="accounts">เฉพาะบัญชี</option></select></label>
    {canExportFullRegistry ? <div className="grid gap-1.5"><div className="flex items-center gap-1 text-xs font-medium text-slate-600">ความเป็นส่วนตัว <FormInfoPopover label="ข้อมูลการส่งออกแบบเต็ม">ไฟล์ข้อมูลเต็มอาจมีข้อมูลส่วนบุคคล การส่งออกข้อมูลเต็มต้องระบุเหตุผล ระบบจะบันทึก Audit Log และแจ้งผู้ดูแลหมู่บ้านเมื่อ Super Admin ดำเนินการ</FormInfoPopover></div><select value={masked ? "masked" : "full"} onChange={(event) => setMasked(event.target.value === "masked")} className={controlClassName} aria-label="ความเป็นส่วนตัวของข้อมูล"><option value="full">ข้อมูลเต็ม</option><option value="masked">ปกปิดข้อมูลส่วนบุคคล</option></select></div> : null}
    <div className="grid gap-1.5"><span className="flex items-center gap-1 text-xs font-medium text-slate-600">สถานะข้อมูล <FormInfoPopover label="เฉพาะข้อมูลปัจจุบัน">จะส่งออกเฉพาะบุคคลและบัญชีสมาชิกที่มีสถานะใช้งานอยู่ (ACTIVE) โดยไม่รวมรายการสถานะอื่น บ้านยังคงส่งออกตามชุดข้อมูลที่เลือก</FormInfoPopover></span><label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 transition hover:border-slate-300 hover:bg-white"><input type="checkbox" checked={activeOnly} onChange={(event) => setActiveOnly(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-green-600 focus:ring-green-500" /> เฉพาะข้อมูลปัจจุบัน</label></div>
    <label className="grid gap-1.5"><span className="text-xs font-medium text-slate-600">ตั้งแต่วันที่</span><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className={controlClassName} /></label>
    <label className="grid gap-1.5"><span className="text-xs font-medium text-slate-600">ถึงวันที่</span><input type="date" value={to} onChange={(event) => setTo(event.target.value)} className={controlClassName} /></label>
    <div className="flex items-end"><ExportDownload href={href} requireConfirmation={!masked} reasonParam={reasonParam} /></div>
  </div>;
}
