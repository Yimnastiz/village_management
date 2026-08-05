"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
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
  const { pushToast } = useToast();
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
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

  const getCalendarRedirectHref = (startsAt: string) => {
    const date = startsAt.slice(0, 10);
    const month = startsAt.slice(0, 7);
    const params = new URLSearchParams();
    if (/^\d{4}-\d{2}$/.test(month)) params.set("month", month);
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) params.set("date", date);
    const query = params.toString();
    return query ? `/admin/calendar?${query}` : "/admin/calendar";
  };

  const onSubmit = async (data: FormData) => {
    clearErrors("root");

    try {
      if (mode === "create") {
        const result = await createVillageEventAction(data);
        if (!result.success) {
          setError("root", { message: result.error });
          pushToast({
            tone: "error",
            title: "สร้างกิจกรรมไม่สำเร็จ",
            description: result.error,
          });
          return;
        }
        pushToast({
          tone: "success",
          title: "สร้างกิจกรรมเรียบร้อยแล้ว",
          description: "กิจกรรมถูกเพิ่มลงในปฏิทินหมู่บ้านแล้ว",
        });
        router.push(getCalendarRedirectHref(data.startsAt));
      } else {
        const result = await updateVillageEventAction(eventId ?? "", data);
        if (!result.success) {
          setError("root", { message: result.error });
          pushToast({
            tone: "error",
            title: "บันทึกกิจกรรมไม่สำเร็จ",
            description: result.error,
          });
          return;
        }
        pushToast({
          tone: "success",
          title: "บันทึกกิจกรรมเรียบร้อยแล้ว",
          description: "ข้อมูลกิจกรรมถูกอัปเดตแล้ว",
        });
        router.push(`/admin/calendar/${eventId}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "กรุณาตรวจสอบข้อมูลและลองใหม่อีกครั้ง";
      setError("root", { message });
      pushToast({
        tone: "error",
        title: mode === "create" ? "สร้างกิจกรรมไม่สำเร็จ" : "บันทึกกิจกรรมไม่สำเร็จ",
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
          {...register("isPublic")}
          options={[
            { value: "PUBLIC", label: "สาธารณะ" },
            { value: "RESIDENT", label: "เฉพาะลูกบ้าน" },
          ]}
          error={errors.isPublic?.message}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="submit" isLoading={isSubmitting} className="w-full sm:w-auto">
          {mode === "create" ? "บันทึกกิจกรรม" : "บันทึกการแก้ไข"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting} className="w-full sm:w-auto">
          ย้อนกลับ
        </Button>
      </div>
    </form>
  );
}
