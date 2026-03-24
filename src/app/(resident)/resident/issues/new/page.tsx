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
import { FileUpload } from "@/components/ui/file-upload";
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

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("ไม่สามารถอ่านไฟล์ได้"));
    reader.readAsDataURL(file);
  });
}

export default function NewIssuePage() {
  const router = useRouter();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    let uploadedImageDataUrls: string[] = [];
    if (selectedFiles.length > 0) {
      try {
        uploadedImageDataUrls = await Promise.all(selectedFiles.map((file) => fileToDataUrl(file)));
      } catch {
        setError("root", { message: "ไม่สามารถอ่านไฟล์รูปที่อัปโหลดได้" });
        return;
      }
    }

    const result = await createIssueAction({
      title: data.title,
      description: data.description,
      category: data.category,
      priority: data.priority,
      location: data.location,
      imageUrls: uploadedImageDataUrls,
      isPublic: Boolean(data.isPublic),
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

        <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700">
          <input type="checkbox" {...register("isPublic")} />
          เปิดเผยปัญหานี้ให้ลูกบ้านคนอื่นในหมู่บ้านเห็นได้
        </label>

        <div className="space-y-2 rounded-xl border border-gray-200 p-4">
          <p className="text-sm font-medium text-gray-800">รูปภาพประกอบปัญหา</p>
          <FileUpload
            label="อัปโหลดรูปภาพ"
            accept="image/*"
            multiple
            maxSize={5 * 1024 * 1024}
            onFilesChange={(files) => setSelectedFiles(files)}
          />
          {selectedFiles.length === 0 && <p className="text-sm text-gray-500">ยังไม่ได้เลือกรูปภาพ</p>}
        </div>

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
