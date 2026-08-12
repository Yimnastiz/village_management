"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

type Result = { success: true; id?: string; message: string } | { success: false; error: string; field?: "houseNumber" | "address" };
type Props = { action: (formData: FormData) => Promise<Result>; mode?: "create" | "edit"; defaults?: { houseNumber: string; address: string; reason?: string }; onSuccess?: (id?: string) => void; showReason?: boolean };

export function HouseForm({ action, mode = "create", defaults, onSuccess, showReason = mode === "edit" }: Props) {
  const toast = useToast();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<"houseNumber" | "address", string>>>({});
  const houseNumberRef = useRef<HTMLInputElement>(null);

  return <form className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[minmax(160px,0.7fr)_minmax(260px,1.5fr)_auto] sm:items-end sm:p-5" onSubmit={(event) => {
    event.preventDefault();
    setError(""); setFieldErrors({});
    const form = event.currentTarget;
    startTransition(async () => {
      const result = await action(new FormData(form));
      if (!result.success) {
        setError(result.error);
        if (result.field) {
          setFieldErrors({ [result.field]: result.field === "houseNumber" && result.error.includes("มีอยู่") ? "บ้านเลขที่นี้มีอยู่แล้ว" : result.error });
          if (result.field === "houseNumber") requestAnimationFrame(() => houseNumberRef.current?.focus());
        }
        toast.error(mode === "create" ? "เพิ่มบ้านไม่สำเร็จ" : "แก้ไขบ้านไม่สำเร็จ", result.error);
        return;
      }
      toast.success(result.message);
      if (mode === "create") form.reset();
      onSuccess?.(result.id);
      router.refresh();
    });
  }}>
    <Input ref={houseNumberRef} name="houseNumber" label="บ้านเลขที่" required maxLength={50} defaultValue={defaults?.houseNumber} placeholder="เช่น 99/1" error={fieldErrors.houseNumber} />
    <Input name="address" label="ที่อยู่เพิ่มเติม" defaultValue={defaults?.address} maxLength={300} error={fieldErrors.address} helperText="เช่น ซอย จุดสังเกต หรือรายละเอียดที่ช่วยระบุตำแหน่งบ้าน" />
    <div className="flex sm:justify-end"><Button className="w-full sm:w-auto" type="submit" disabled={pending} isLoading={pending}>{mode === "create" ? "เพิ่มบ้าน" : "บันทึกการแก้ไข"}</Button></div>
    {showReason ? <Input className="sm:col-span-2" name="reason" label="เหตุผล/หมายเหตุการแก้ไข" defaultValue={defaults?.reason} maxLength={300} helperText="ข้อความนี้จะถูกบันทึกใน Audit Log" /> : null}
    {error && !fieldErrors.houseNumber && !fieldErrors.address ? <p className="text-sm text-rose-600 sm:col-span-full">{error}</p> : null}
  </form>;
}
