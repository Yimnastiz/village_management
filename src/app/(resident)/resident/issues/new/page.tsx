"use client";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ISSUE_CATEGORY_LABELS, ISSUE_PRIORITY_LABELS } from "@/lib/constants";
import { createIssueAction } from "../actions";

const schema = z.object({
  title: z.string().min(5, "กรุณาระบุหัวข้อ (อย่างน้อย 5 ตัวอักษร)"),
  category: z.string().min(1, "กรุณาเลือกหมวดหมู่"),
  priority: z.string().min(1, "กรุณาเลือกระดับความสำคัญ"),
  description: z.string().min(10, "กรุณาอธิบายรายละเอียด (อย่างน้อย 10 ตัวอักษร)"),
  location: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function NewIssuePage() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    const result = await createIssueAction({
      title: data.title,
      description: data.description,
      category: data.category,
      priority: data.priority,
      location: data.location,
    });
    if (!result.success) {
      setError("root", { message: result.error });
      return;
    }
    router.push("/resident/issues");
  };

  const categoryOptions = Object.entries(ISSUE_CATEGORY_LABELS).map(([v, l]) => ({ value: v, label: l }));
  const priorityOptions = Object.entries(ISSUE_PRIORITY_LABELS).map(([v, l]) => ({ value: v, label: l }));

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/resident/issues" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">แจ้งปัญหาใหม่</h1>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="bg-white rounded-xl border border-gray-200 p-6 space-y-4"
      >
        <Input
          label="หัวข้อปัญหา"
          {...register("title")}
          error={errors.title?.message}
          placeholder="เช่น ท่อน้ำรั่วหน้าบ้านเลขที่ 5"
        />
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="หมวดหมู่"
            {...register("category")}
            error={errors.category?.message}
            options={categoryOptions}
            placeholder="-- เลือกหมวดหมู่ --"
          />
          <Select
            label="ระดับความสำคัญ"
            {...register("priority")}
            error={errors.priority?.message}
            options={priorityOptions}
            placeholder="-- เลือก --"
          />
        </div>
        <Textarea
          label="รายละเอียด"
          {...register("description")}
          error={errors.description?.message}
          placeholder="อธิบายปัญหาให้ชัดเจน..."
          rows={4}
        />
        <Input
          label="สถานที่ (ไม่บังคับ)"
          {...register("location")}
          placeholder="เช่น หน้าบ้านเลขที่ 123"
        />
        {errors.root && <p className="text-sm text-red-600">{errors.root.message}</p>}
        <div className="flex gap-3 pt-2">
          <Button type="submit" isLoading={isSubmitting}>ส่งคำร้อง</Button>
          <Link href="/resident/issues">
            <Button type="button" variant="outline">ยกเลิก</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
