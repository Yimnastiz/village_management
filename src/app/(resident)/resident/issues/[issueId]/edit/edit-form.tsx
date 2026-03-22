"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { editIssueAction } from "../../actions";

const schema = z.object({
  title: z.string().min(5, "หัวข้อต้องมีอย่างน้อย 5 ตัวอักษร"),
  category: z.string().min(1, "กรุณาเลือกหมวดหมู่"),
  priority: z.string().min(1, "กรุณาเลือกระดับความสำคัญ"),
  description: z.string().min(10, "รายละเอียดต้องมีอย่างน้อย 10 ตัวอักษร"),
  location: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

type EditIssueFormProps = {
  issueId: string;
  defaultValues: FormData;
  categoryOptions: { value: string; label: string }[];
  priorityOptions: { value: string; label: string }[];
};

export function EditIssueForm({
  issueId,
  defaultValues,
  categoryOptions,
  priorityOptions,
}: EditIssueFormProps) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const onSubmit = async (data: FormData) => {
    const result = await editIssueAction(issueId, {
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
    router.push(`/resident/issues/${issueId}`);
    router.refresh();
  };

  return (
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
        <Button type="submit" isLoading={isSubmitting}>
          บันทึกการแก้ไข
        </Button>
        <Link href={`/resident/issues/${issueId}`}>
          <Button type="button" variant="outline">
            ยกเลิก
          </Button>
        </Link>
      </div>
    </form>
  );
}
