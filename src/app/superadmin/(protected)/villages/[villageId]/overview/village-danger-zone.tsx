"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { deleteVillageAction } from "../../actions";

export function VillageDangerZone({ villageId, villageName }: { villageId: string; villageName: string }) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const remove = async () => {
    setPending(true);
    setError("");
    try {
      const data = new FormData();
      data.set("id", villageId);
      await deleteVillageAction(data);
      pushToast({ tone: "success", title: "ลบหมู่บ้านแล้ว", description: villageName });
      router.replace("/superadmin/villages");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "เกิดข้อผิดพลาด";
      setError(message);
      pushToast({ tone: "error", title: "ลบหมู่บ้านไม่สำเร็จ", description: message });
    } finally {
      setPending(false);
      setOpen(false);
    }
  };

  return (
    <section className="rounded-xl border border-red-200 bg-white p-4 sm:p-5">
      <div className="max-w-2xl">
        <h2 className="font-semibold text-slate-900">การดำเนินการที่มีความเสี่ยง</h2>
        <p className="mt-1 text-sm text-slate-600">การปิดใช้งานเป็นการดำเนินการแบบย้อนกลับได้และยังเก็บข้อมูลไว้ ส่วนการลบไม่สามารถย้อนกลับได้ และอนุญาตเฉพาะหมู่บ้านที่ยังไม่มีข้อมูลการใช้งานที่เกี่ยวข้อง</p>
        <p className="mt-2 text-xs text-slate-500">หากหมู่บ้านมีข้อมูลการใช้งาน ให้ปิดใช้งานแทนการลบ</p>
        {error ? <p className="mt-3 text-sm text-red-700" role="alert">{error}</p> : null}
        <Button type="button" size="sm" variant="dangerOutline" className="mt-4" onClick={() => setOpen(true)} disabled={pending}>ลบหมู่บ้าน</Button>
      </div>
      <ConfirmDialog open={open} title="ยืนยันการลบหมู่บ้าน" description="การดำเนินการนี้ไม่สามารถย้อนกลับได้ และระบบจะอนุญาตเฉพาะหมู่บ้านที่ยังไม่มีข้อมูลการใช้งานที่เกี่ยวข้อง" tone="danger" pending={pending} onClose={() => !pending && setOpen(false)} onConfirm={() => { void remove(); }} />
    </section>
  );
}
