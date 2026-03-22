"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createVillageEventAction, updateVillageEventAction } from "./actions";

const schema = z.object({
  title: z.string().min(3, "กรุณาระบุชื่อกิจกรรม"),
  description: z.string().optional(),
  location: z.string().optional(),
  startsAt: z.string().min(1, "กรุณาระบุวันเวลาเริ่ม"),
  endsAt: z.string().optional(),
  isPublic: z.string().min(1, "กรุณาเลือกการมองเห็น"),
});

type FormData = z.infer<typeof schema>;

type CalendarFormProps = {
  mode: "create" | "edit";
  eventId?: string;
  defaultValues?: {
    title: string;
    description: string;
    location: string;
    startsAt: string;
    endsAt: string;
    isPublic: string;
  };
};

export function CalendarForm({ mode, eventId, defaultValues }: CalendarFormProps) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? {
      title: "",
      description: "",
      location: "",
      startsAt: "",
      endsAt: "",
      isPublic: "PUBLIC",
    },
  });

  const onSubmit = async (data: FormData) => {
    if (mode === "create") {
      const result = await createVillageEventAction(data);
      if (!result.success) {
        setError("root", { message: result.error });
        return;
      }
      router.push(`/admin/calendar/${result.id}`);
    } else {
      const result = await updateVillageEventAction(eventId ?? "", data);
      if (!result.success) {
        setError("root", { message: result.error });
        return;
      }
      router.push(`/admin/calendar/${eventId}`);
    }
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <Input label="ชื่อกิจกรรม" {...register("title")} error={errors.title?.message} />
      <Textarea label="รายละเอียด" {...register("description")} error={errors.description?.message} rows={4} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="สถานที่" {...register("location")} error={errors.location?.message} />
        <Select
          label="การมองเห็น"
          {...register("isPublic")}
          options={[
            { value: "PUBLIC", label: "สาธารณะ" },
            { value: "RESIDENT", label: "เฉพาะลูกบ้าน" },
          ]}
          error={errors.isPublic?.message}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="วันเวลาเริ่ม"
          type="datetime-local"
          {...register("startsAt")}
          error={errors.startsAt?.message}
        />
        <Input
          label="วันเวลาสิ้นสุด"
          type="datetime-local"
          {...register("endsAt")}
          error={errors.endsAt?.message}
        />
      </div>

      {errors.root && <p className="text-sm text-red-600">{errors.root.message}</p>}

      <div className="flex gap-3">
        <Button type="submit" isLoading={isSubmitting}>
          {mode === "create" ? "บันทึกกิจกรรม" : "บันทึกการแก้ไข"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          ย้อนกลับ
        </Button>
      </div>
    </form>
  );
}
