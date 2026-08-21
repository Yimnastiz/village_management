"use client";

import { useMemo, useState } from "react";
import { ExportDownload } from "./export-download";

type Zone = { id: string; name: string };

export function PopulationExportForm({ zones, canExportFullRegistry }: { zones: Zone[]; canExportFullRegistry: boolean }) {
  const [sheets, setSheets] = useState("houses,people,accounts");
  const [activeOnly, setActiveOnly] = useState(false);
  const [zoneId, setZoneId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const href = useMemo(() => {
    const params = new URLSearchParams({ sheets, masked: canExportFullRegistry ? "false" : "true" });
    if (activeOnly) params.set("activeOnly", "true");
    if (zoneId) params.set("zoneId", zoneId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return `/api/admin/population/export?${params.toString()}`;
  }, [activeOnly, canExportFullRegistry, from, sheets, to, zoneId]);

  return <div className="flex flex-wrap items-center gap-2">
    <select value={sheets} onChange={(event) => setSheets(event.target.value)} className="rounded-lg border px-2 py-2 text-sm" aria-label="ชุดข้อมูลที่ส่งออก"><option value="houses,people,accounts">บ้าน บุคคล บัญชี</option><option value="houses">เฉพาะบ้าน</option><option value="people">เฉพาะบุคคล</option><option value="accounts">เฉพาะบัญชี</option></select>
    <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={activeOnly} onChange={(event) => setActiveOnly(event.target.checked)} /> Active only</label>
    <select value={zoneId} onChange={(event) => setZoneId(event.target.value)} className="rounded-lg border px-2 py-2 text-sm" aria-label="โซน"><option value="">ทุกโซน</option>{zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}</select>
    <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="rounded-lg border px-2 py-2 text-sm" aria-label="ตั้งแต่วันที่" />
    <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="rounded-lg border px-2 py-2 text-sm" aria-label="ถึงวันที่" />
    <ExportDownload href={href} requireConfirmation={canExportFullRegistry} />
  </div>;
}
