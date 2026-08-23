"use client";
import { useState } from "react";
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
import { useToast } from "@/components/ui/toast";
import { IssueImageManager } from "@/components/issues/issue-image-manager";
import type { IssueImageInput } from "@/lib/issue-images";
import { ISSUE_CATEGORY_LABELS, ISSUE_PRIORITY_LABELS } from "@/lib/constants";
import { createIssueAction } from "../actions";

const schema = z.object({
  title: z.string().min(5, "กรุณาระบุหัวข้อ (อย่างน้อย 5 ตัวอักษร)"),
  category: z.string().min(1, "กรุณาเลือกหมวดหมู่"),
  priority: z.string().min(1, "กรุณาเลือกระดับความสำคัญ"),
  description: z.string().min(10, "กรุณาอธิบายรายละเอียด (อย่างน้อย 10 ตัวอักษร)"),
  location: z.string().optional(),
  isPublic: z.boolean().optional(),
});

type FormData = z.infer<typeof schema>;

export default function NewIssuePage() {
  const router = useRouter();
  const toast = useToast();
  const [images, setImages] = useState<IssueImageInput[]>([]);
  const [imagesBusy, setImagesBusy] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    if (imagesBusy) { toast.error("ส่งคำร้องไม่สำเร็จ", "กรุณารอให้การอัปโหลดรูปภาพเสร็จสิ้น"); return; }

    try {
      const result = await createIssueAction({
        title: data.title,
        description: data.description,
        category: data.category,
        priority: data.priority,
        location: data.location,
        imageUrls: images,
        isPublic: Boolean(data.isPublic),
      });
      if (!result.success) {
        toast.error("ส่งคำร้องไม่สำเร็จ", result.error);
        return;
      }
      toast.success("ส่งคำร้องเรียบร้อยแล้ว");
      router.push("/resident/issues");
    } catch {
      toast.error("ส่งคำร้องไม่สำเร็จ", "กรุณาลองใหม่อีกครั้ง");
    }
  };

  const categoryOptions = Object.entries(ISSUE_CATEGORY_LABELS).map(([v, l]) => ({ value: v, label: l }));
  const priorityOptions = Object.entries(ISSUE_PRIORITY_LABELS).map(([v, l]) => ({ value: v, label: l }));

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div>
        <Link href="/resident/issues" aria-label="กลับรายการแจ้งปัญหา" className="inline-flex items-center gap-1.5 px-1 py-2 text-sm text-gray-500 transition-colors hover:text-gray-700">
          <ArrowLeft className="h-5 w-5" />
          กลับรายการแจ้งปัญหา
        </Link>
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

        <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700">
          <input type="checkbox" {...register("isPublic")} />
          เปิดเผยปัญหานี้ให้ลูกบ้านคนอื่นในหมู่บ้านเห็นได้
        </label>

        <IssueImageManager value={images} onChange={setImages} onBusyChange={setImagesBusy} disabled={isSubmitting} />

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
