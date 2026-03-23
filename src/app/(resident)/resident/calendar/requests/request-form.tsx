"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createVillageEventSubmissionAction } from "./actions";

const schema = z.object({
  title: z.string().min(3, "กรุณาระบุชื่อกิจกรรม"),
  description: z.string().optional(),
  location: z.string().optional(),
  startsAt: z.string().min(1, "กรุณาระบุวันเวลาเริ่ม"),
  endsAt: z.string().optional(),
  visibility: z.string().min(1, "กรุณาเลือกการมองเห็น"),
});

type FormData = z.infer<typeof schema>;

export function CalendarRequestForm() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      description: "",
      location: "",
      startsAt: "",
      endsAt: "",
      visibility: "RESIDENT",
    },
  });

  const onSubmit = async (data: FormData) => {
    const result = await createVillageEventSubmissionAction(data);
    if (!result.success) {
      setError("root", { message: result.error });
      return;
    }

    router.push("/resident/calendar/requests?submitted=1");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
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

      <div className="flex items-center gap-3">
        <Button type="submit" isLoading={isSubmitting}>ส่งคำขอเพิ่มกิจกรรม</Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>ย้อนกลับ</Button>
      </div>
    </form>
  );
}
