"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { ActionReasonDialog } from "@/components/admin/action-reason-dialog";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { createSuperAdminVillageEventAction, deleteSuperAdminVillageEventAction, updateSuperAdminVillageEventAction } from "./calendar-actions";

const eventSchema = z.object({
  title: z.string().trim().min(3, "กรุณาระบุชื่อกิจกรรมอย่างน้อย 3 ตัวอักษร"),
  description: z.string().optional(),
  location: z.string().optional(),
  startsAt: z.string().min(1, "กรุณาระบุวันเวลาเริ่ม"),
  endsAt: z.string().optional(),
  isPublic: z.enum(["PUBLIC", "RESIDENT"]),
}).superRefine((value, ctx) => {
  const start = new Date(value.startsAt);
  const end = value.endsAt?.trim() ? new Date(value.endsAt) : null;
  if (Number.isNaN(start.getTime())) ctx.addIssue({ code: "custom", path: ["startsAt"], message: "วันเวลาเริ่มไม่ถูกต้อง" });
  if (end && Number.isNaN(end.getTime())) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "วันเวลาสิ้นสุดไม่ถูกต้อง" });
  if (end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end < start) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "วันเวลาสิ้นสุดต้องไม่ก่อนวันเวลาเริ่ม" });
});

type EventValues = z.infer<typeof eventSchema>;
type EventRow = { id: string; title: string; description: string | null; location: string | null; startsAt: string; endsAt: string | null; isPublic: boolean };

function localDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function EventForm({ villageId, event, onClose }: { villageId: string; event?: EventRow; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [reasonOpen, setReasonOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const { register, handleSubmit, formState: { errors }, getValues } = useForm<EventValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: event ? { title: event.title, description: event.description ?? "", location: event.location ?? "", startsAt: localDateTime(event.startsAt), endsAt: localDateTime(event.endsAt), isPublic: event.isPublic ? "PUBLIC" : "RESIDENT" } : { title: "", description: "", location: "", startsAt: "", endsAt: "", isPublic: "PUBLIC" },
  });
  const submit = handleSubmit(() => setReasonOpen(true));
  const confirm = (supportReason: string) => startTransition(async () => {
    const data = getValues();
    const result = event
      ? await updateSuperAdminVillageEventAction(villageId, event.id, data, supportReason)
      : await createSuperAdminVillageEventAction(villageId, data, supportReason);
    if (!result.success) { toast.error(event ? "บันทึกกิจกรรมไม่สำเร็จ" : "สร้างกิจกรรมไม่สำเร็จ", result.error); return; }
    toast.success(event ? "บันทึกกิจกรรมเรียบร้อย" : "สร้างกิจกรรมเรียบร้อย");
    setReasonOpen(false); onClose(); router.refresh();
  });
  return <>
    <form onSubmit={submit} className="space-y-4">
      <Input label="ชื่อกิจกรรม" required {...register("title")} error={errors.title?.message} />
      <Textarea label="รายละเอียด" rows={4} {...register("description")} error={errors.description?.message} />
      <div className="grid gap-4 sm:grid-cols-2"><Input label="สถานที่" {...register("location")} error={errors.location?.message} /><Select label="การมองเห็น" required {...register("isPublic")} options={[{ value: "PUBLIC", label: "สาธารณะ" }, { value: "RESIDENT", label: "เฉพาะลูกบ้าน" }]} error={errors.isPublic?.message} /></div>
      <div className="grid gap-4 sm:grid-cols-2"><Input label="วันเวลาเริ่ม" type="datetime-local" required {...register("startsAt")} error={errors.startsAt?.message} /><Input label="วันเวลาสิ้นสุด" type="datetime-local" {...register("endsAt")} error={errors.endsAt?.message} /></div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={onClose} disabled={pending}>ยกเลิก</Button><Button type="submit" disabled={pending}>{event ? "บันทึกการแก้ไข" : "สร้างกิจกรรม"}</Button></div>
    </form>
    <ActionReasonDialog open={reasonOpen} action="content.delete" title={event ? "ยืนยันการแก้ไขกิจกรรม" : "ยืนยันการสร้างกิจกรรม"} description="ระบบจะดำเนินการแทนผู้ดูแลหมู่บ้านหลังยืนยัน" reasonLabel="เหตุผลในการดำเนินการ" helperText="ระบุเหตุผลที่ผู้ดูแลระบบระดับสูงดำเนินการแทนผู้ดูแลหมู่บ้าน" requireReason minReasonLength={5} maxReasonLength={500} submitLabel="ยืนยันดำเนินการ" loading={pending} onCancel={() => setReasonOpen(false)} onSubmit={confirm} />
  </>;
}

export function SuperAdminCalendarEventActions({ villageId, event }: { villageId: string; event?: EventRow }) {
  const router = useRouter();
  const toast = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const remove = (supportReason: string) => {
    if (!event) return;
    startTransition(async () => {
      const result = await deleteSuperAdminVillageEventAction(villageId, event.id, supportReason);
      if (!result.success) { toast.error("ลบกิจกรรมไม่สำเร็จ", result.error); return; }
      toast.success("ลบกิจกรรมเรียบร้อย"); setDeleteOpen(false); router.refresh();
    });
  };
  return <>
    {event ? <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => setFormOpen(true)}><Pencil className="h-4 w-4" /><span className="ml-1">แก้ไข</span></Button><Button size="sm" variant="danger" onClick={() => setDeleteOpen(true)}><Trash2 className="h-4 w-4" /><span className="ml-1">ลบ</span></Button></div> : <Button size="sm" onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" /><span className="ml-1">เพิ่มกิจกรรม</span></Button>}
    <Dialog open={formOpen} title={event ? "แก้ไขกิจกรรม" : "เพิ่มกิจกรรม"} description="ข้อมูลจะถูกตรวจสอบก่อนขอเหตุผลในการดำเนินการ" onClose={() => !pending && setFormOpen(false)} closeOnBackdrop={!pending} closeOnEscape={!pending}><EventForm villageId={villageId} event={event} onClose={() => setFormOpen(false)} /></Dialog>
    {event ? <ActionReasonDialog open={deleteOpen} action="content.delete" title={`ลบกิจกรรม ${event.title}`} description="กิจกรรมจะถูกลบออกจากปฏิทินตามพฤติกรรมเดิมของระบบ" reasonLabel="เหตุผลในการดำเนินการ" helperText="ระบุเหตุผลที่ผู้ดูแลระบบระดับสูงดำเนินการแทนผู้ดูแลหมู่บ้าน" requireReason minReasonLength={5} maxReasonLength={500} submitLabel="ยืนยันลบกิจกรรม" loading={pending} onCancel={() => setDeleteOpen(false)} onSubmit={remove} /> : null}
  </>;
}
