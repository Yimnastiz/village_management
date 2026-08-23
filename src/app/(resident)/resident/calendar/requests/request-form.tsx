"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useEffect } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { createVillageEventSubmissionAction, updateResidentVillageEventSubmissionAction } from "./actions";

const schema = z.object({
  title: z.string().trim().min(3, "กรุณาระบุชื่อกิจกรรมอย่างน้อย 3 ตัวอักษร"),
  description: z.string().optional(),
  location: z.string().optional(),
  startsAt: z.string().min(1, "กรุณาระบุวันและเวลาเริ่ม"),
  endsAt: z.string().optional(),
  visibility: z.enum(["PUBLIC", "RESIDENT"], { message: "กรุณาเลือกการมองเห็นที่ต้องการ" }),
}).superRefine((data, context) => {
  if (!data.endsAt?.trim()) return;
  const startsAt = new Date(data.startsAt), endsAt = new Date(data.endsAt);
  if (Number.isNaN(endsAt.getTime()) || endsAt < startsAt) context.addIssue({ code: "custom", path: ["endsAt"], message: "วันและเวลาสิ้นสุดต้องไม่ก่อนวันและเวลาเริ่ม" });
});

export type CalendarRequestFormData = z.infer<typeof schema>;

type CalendarRequestFormProps = {
  requestId?: string;
  initialValues?: Partial<CalendarRequestFormData>;
  approved?: boolean;
  /** Keeps the shared fields compact when rendered inside the Calendar modal. */
  embedded?: boolean;
  formId?: string;
  hideActions?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
  onSubmittingChange?: (isSubmitting: boolean) => void;
};

export function CalendarRequestForm({ requestId, initialValues, approved = false, embedded = false, formId, hideActions = false, onSuccess, onCancel, onSubmittingChange }: CalendarRequestFormProps = {}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const { register, handleSubmit, setError, clearErrors, reset, formState: { errors, isSubmitting } } = useForm<CalendarRequestFormData>({
    resolver: zodResolver(schema),
    defaultValues: { title: initialValues?.title ?? "", description: initialValues?.description ?? "", location: initialValues?.location ?? "", startsAt: initialValues?.startsAt ?? "", endsAt: initialValues?.endsAt ?? "", visibility: initialValues?.visibility ?? "RESIDENT" },
  });
  useEffect(() => { onSubmittingChange?.(isSubmitting); }, [isSubmitting, onSubmittingChange]);
  const onSubmit = async (data: CalendarRequestFormData) => {
    clearErrors("root");
    try {
      const result = requestId ? await updateResidentVillageEventSubmissionAction(requestId, data) : await createVillageEventSubmissionAction(data);
      if (!result.success) {
        setError("root", { message: result.error });
        pushToast({ tone: "error", title: requestId ? "บันทึกคำขอไม่สำเร็จ" : "ส่งคำขอกิจกรรมไม่สำเร็จ", description: result.error });
        return;
      }
      if (!requestId) reset();
      pushToast({ tone: "success", title: requestId ? "บันทึกการแก้ไขเรียบร้อยแล้ว" : "ส่งคำขอกิจกรรมเรียบร้อยแล้ว", description: requestId ? undefined : "รอผู้ใหญ่บ้านตรวจสอบและอนุมัติ" });
      if (onSuccess) { onSuccess(); router.refresh(); return; }
      router.push(requestId ? `/resident/calendar/requests/${result.requestId}?updated=1` : "/resident/calendar/requests");
    } catch (error) {
      const message = error instanceof Error ? error.message : "กรุณาตรวจสอบข้อมูลและลองใหม่อีกครั้ง";
      setError("root", { message });
      pushToast({ tone: "error", title: requestId ? "บันทึกคำขอไม่สำเร็จ" : "ส่งคำขอกิจกรรมไม่สำเร็จ", description: message });
    }
  };
  const actions = <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={onCancel ?? (() => router.back())} disabled={isSubmitting}>ยกเลิก</Button><Button type="submit" form={formId} isLoading={isSubmitting} disabled={isSubmitting}>{requestId ? "บันทึกการแก้ไข" : "ส่งคำขอกิจกรรม"}</Button></div>;
  return <form id={formId} onSubmit={handleSubmit(onSubmit)} className={embedded ? "space-y-4" : "space-y-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-6"}>
    <Input label="ชื่อกิจกรรม" required {...register("title")} error={errors.title?.message} />
    <Textarea label="รายละเอียด" {...register("description")} error={errors.description?.message} rows={embedded ? 3 : 4} />
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Input label="สถานที่" {...register("location")} error={errors.location?.message} /><Select label="การมองเห็นที่ต้องการ" required helperText="ผู้ใหญ่บ้านสามารถปรับการมองเห็นก่อนอนุมัติได้" {...register("visibility")} options={[{ value: "RESIDENT", label: "เฉพาะลูกบ้าน" }, { value: "PUBLIC", label: "สาธารณะ" }]} error={errors.visibility?.message} /></div>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Input label="วันและเวลาเริ่ม" type="datetime-local" required {...register("startsAt")} error={errors.startsAt?.message} /><Input label="วันและเวลาสิ้นสุด" type="datetime-local" {...register("endsAt")} error={errors.endsAt?.message} /></div>
    {errors.root ? <p className="text-sm text-red-600">{errors.root.message}</p> : null}
    {approved ? <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">รายการนี้ได้รับอนุมัติแล้ว การแก้ไขจะเป็นคำขอแก้ไขที่รอผู้ใหญ่บ้านอนุมัติ</p> : null}
    {!hideActions ? actions : null}
  </form>;
}
