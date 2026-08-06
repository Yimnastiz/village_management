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
import { updateVillageEventSubmissionAction } from "../actions";

const schema = z.object({
  title: z.string().min(3, "กรุณาระบุชื่อกิจกรรม"),
  description: z.string().optional(),
  location: z.string().optional(),
  startsAt: z.string().min(1, "กรุณาระบุวันเวลาเริ่ม"),
  endsAt: z.string().optional(),
  isPublic: z.string().min(1, "กรุณาเลือกการมองเห็น"),
});

type FormData = z.infer<typeof schema>;

export function CalendarRequestEditForm({ requestId, defaultValues }: { requestId: string; defaultValues: FormData }) {
  const router = useRouter();
  const { pushToast } = useToast();
  const { register, handleSubmit, setError, clearErrors, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const onSubmit = async (data: FormData) => {
    clearErrors("root");
    try {
      const result = await updateVillageEventSubmissionAction(requestId, data);
      if (!result.success) {
        setError("root", { message: result.error });
        pushToast({ tone: "error", title: "แก้ไขคำขอไม่สำเร็จ", description: result.error });
        return;
      }

      pushToast({ tone: "success", title: "แก้ไขคำขอเรียบร้อยแล้ว" });
      router.push(`/admin/calendar/requests/${requestId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "กรุณาลองใหม่อีกครั้ง";
      setError("root", { message });
      pushToast({ tone: "error", title: "แก้ไขคำขอไม่สำเร็จ", description: message });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
      <Input label="ชื่อกิจกรรม" {...register("title")} error={errors.title?.message} />
      <Textarea label="รายละเอียด" rows={4} {...register("description")} error={errors.description?.message} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="สถานที่" {...register("location")} error={errors.location?.message} />
        <Select label="การมองเห็น" {...register("isPublic")} options={[
          { value: "PUBLIC", label: "สาธารณะ" },
          { value: "RESIDENT", label: "เฉพาะลูกบ้าน" },
        ]} error={errors.isPublic?.message} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="วันเวลาเริ่ม" type="datetime-local" {...register("startsAt")} error={errors.startsAt?.message} />
        <Input label="วันเวลาสิ้นสุด" type="datetime-local" {...register("endsAt")} error={errors.endsAt?.message} />
      </div>
      {errors.root ? <p className="text-sm text-red-600">{errors.root.message}</p> : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" isLoading={isSubmitting} className="w-full sm:w-auto">บันทึกการแก้ไข</Button>
        <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => router.back()} className="w-full sm:w-auto">ยกเลิก</Button>
      </div>
    </form>
  );
}
