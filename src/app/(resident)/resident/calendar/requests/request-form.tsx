"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { createVillageEventSubmissionAction, updateResidentVillageEventSubmissionAction } from "./actions";

const schema = z.object({
  title: z.string().min(3, "กรุณาระบุชื่อกิจกรรม"),
  description: z.string().optional(),
  location: z.string().optional(),
  startsAt: z.string().min(1, "กรุณาระบุวันเวลาเริ่ม"),
  endsAt: z.string().optional(),
  visibility: z.string().min(1, "กรุณาเลือกการมองเห็น"),
});

type FormData = z.infer<typeof schema>;

export function CalendarRequestForm({ requestId, initialValues, approved = false }: { requestId?: string; initialValues?: Partial<FormData>; approved?: boolean } = {}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: initialValues?.title ?? "",
      description: initialValues?.description ?? "",
      location: initialValues?.location ?? "",
      startsAt: initialValues?.startsAt ?? "",
      endsAt: initialValues?.endsAt ?? "",
      visibility: initialValues?.visibility ?? "RESIDENT",
    },
  });

  const onSubmit = async (data: FormData) => {
    clearErrors("root");

    try {
      const result = requestId ? await updateResidentVillageEventSubmissionAction(requestId, data) : await createVillageEventSubmissionAction(data);
      if (!result.success) {
        setError("root", { message: result.error });
        pushToast({
          tone: "error",
          title: "ส่งคำขอไม่สำเร็จ",
          description: result.error || "กรุณาตรวจสอบข้อมูลและลองใหม่อีกครั้ง",
        });
        return;
      }

      if (!requestId) reset();
      pushToast({
        tone: "success",
        title: "ส่งคำขอกิจกรรมเรียบร้อยแล้ว",
        description: "ระบบได้ส่งคำขอให้ผู้ดูแลหมู่บ้านตรวจสอบแล้ว",
      });
      router.push(requestId ? `/resident/calendar/requests/${result.requestId}?updated=1` : "/resident/calendar/requests?submitted=1");
    } catch (error) {
      const message = error instanceof Error ? error.message : "กรุณาตรวจสอบข้อมูลและลองใหม่อีกครั้ง";
      setError("root", { message });
      pushToast({
        tone: "error",
        title: "ส่งคำขอไม่สำเร็จ",
        description: message,
      });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
      <Input label="ชื่อกิจกรรม" {...register("title")} error={errors.title?.message} />
      <Textarea label="รายละเอียด" {...register("description")} error={errors.description?.message} rows={4} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input label="สถานที่" {...register("location")} error={errors.location?.message} />
        <Select
          label="การมองเห็น"
          {...register("visibility")}
          options={[
            { value: "PUBLIC", label: "สาธารณะ" },
            { value: "RESIDENT", label: "เฉพาะลูกบ้าน" },
          ]}
          error={errors.visibility?.message}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input label="วันเวลาเริ่ม" type="datetime-local" {...register("startsAt")} error={errors.startsAt?.message} />
        <Input label="วันเวลาสิ้นสุด" type="datetime-local" {...register("endsAt")} error={errors.endsAt?.message} />
      </div>

      {errors.root && <p className="text-sm text-red-600">{errors.root.message}</p>}

      {approved ? <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">รายการนี้ได้รับอนุมัติแล้ว การแก้ไขจะมีผลหลังผู้ใหญ่บ้านอนุมัติคำขอแก้ไข</p> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="submit" isLoading={isSubmitting} className="w-full sm:w-auto">{requestId ? "ยืนยัน" : "ส่งคำขอเพิ่มกิจกรรม"}</Button>
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting} className="w-full sm:w-auto">ย้อนกลับ</Button>
      </div>
    </form>
  );
}
