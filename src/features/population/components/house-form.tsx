"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";

type Result = { success: true; id?: string; message: string } | { success: false; error: string };
type Props = { action: (formData: FormData) => Promise<Result>; mode?: "create" | "edit"; defaults?: { houseNumber: string; address: string; occupancyStatus: string; reason: string }; onSuccess?: (id?: string) => void };

export function HouseForm({ action, mode = "create", defaults, onSuccess }: Props) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  return <form className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5" onSubmit={(event) => {
    event.preventDefault(); setError(""); const formData = new FormData(event.currentTarget);
    startTransition(async () => { const result = await action(formData); if (!result.success) { setError(result.error); toast.error(mode === "create" ? "เพิ่มบ้านไม่สำเร็จ" : "แก้ไขบ้านไม่สำเร็จ", result.error); return; } toast.success(result.message); if (mode === "create") event.currentTarget.reset(); onSuccess?.(result.id); });
  }}>
    <div className="grid gap-4 md:grid-cols-2">
      <Input name="houseNumber" label="บ้านเลขที่" required maxLength={50} defaultValue={defaults?.houseNumber} placeholder="เช่น 99/1" />
      <Select name="occupancyStatus" label="สถานะบ้าน" defaultValue={defaults?.occupancyStatus ?? "OCCUPIED"} options={[{value:"OCCUPIED",label:"มีผู้อยู่อาศัย"},{value:"VACANT",label:"ว่าง"},{value:"UNDER_CONSTRUCTION",label:"กำลังก่อสร้าง"},{value:"DEMOLISHED",label:"รื้อถอนแล้ว"}]} />
    </div>
    <Input name="address" label="ที่อยู่เพิ่มเติม" defaultValue={defaults?.address} maxLength={300} />
    <Input name="reason" label="เหตุผล/หมายเหตุการช่วยเหลือ" defaultValue={defaults?.reason} maxLength={300} helperText="ข้อความนี้จะถูกบันทึกใน Audit Log" />
    {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    <div className="flex flex-wrap justify-end gap-2"><Button type="submit" isLoading={pending}>{mode === "create" ? "เพิ่มบ้าน" : "บันทึกการแก้ไข"}</Button></div>
  </form>;
}
