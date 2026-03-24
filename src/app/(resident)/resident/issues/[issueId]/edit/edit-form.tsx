"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/ui/file-upload";
import { editIssueAction } from "../../actions";

const schema = z.object({
  title: z.string().min(5, "หัวข้อต้องมีอย่างน้อย 5 ตัวอักษร"),
  category: z.string().min(1, "กรุณาเลือกหมวดหมู่"),
  priority: z.string().min(1, "กรุณาเลือกระดับความสำคัญ"),
  description: z.string().min(10, "รายละเอียดต้องมีอย่างน้อย 10 ตัวอักษร"),
  location: z.string().optional(),
  isPublic: z.boolean().optional(),
});

type FormData = z.infer<typeof schema>;

type EditIssueFormProps = {
  issueId: string;
  defaultValues: FormData & { imageUrls: string[] };
  categoryOptions: { value: string; label: string }[];
  priorityOptions: { value: string; label: string }[];
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("ไม่สามารถอ่านไฟล์ได้"));
    reader.readAsDataURL(file);
  });
}

function normalizeExistingImageUrls(imageUrls: string[]) {
  return imageUrls.map((url) => url.trim()).filter((url) => url.length > 0);
}

export function EditIssueForm({
  issueId,
  defaultValues,
  categoryOptions,
  priorityOptions,
}: EditIssueFormProps) {
  const router = useRouter();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>(
    normalizeExistingImageUrls(defaultValues.imageUrls)
  );
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
    let uploadedImageDataUrls: string[] = [];
    if (selectedFiles.length > 0) {
      try {
        uploadedImageDataUrls = await Promise.all(selectedFiles.map((file) => fileToDataUrl(file)));
      } catch {
        setError("root", { message: "ไม่สามารถอ่านไฟล์รูปที่อัปโหลดได้" });
        return;
      }
    }

    const result = await editIssueAction(issueId, {
      title: data.title,
      description: data.description,
      category: data.category,
      priority: data.priority,
      location: data.location,
      isPublic: Boolean(data.isPublic),
      imageUrls: [...existingImageUrls, ...uploadedImageDataUrls],
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

      <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700">
        <input type="checkbox" {...register("isPublic")} />
        เปิดเผยปัญหานี้ให้ลูกบ้านคนอื่นในหมู่บ้านเห็นได้
      </label>

      <div className="space-y-3 rounded-xl border border-gray-200 p-4">
        <p className="text-sm font-medium text-gray-800">รูปภาพประกอบปัญหา</p>
        <FileUpload
          label="อัปโหลดรูปภาพเพิ่ม"
          accept="image/*"
          multiple
          maxSize={5 * 1024 * 1024}
          onFilesChange={(files) => setSelectedFiles(files)}
        />

        {existingImageUrls.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">รูปเดิม (กดลบได้)</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {existingImageUrls.map((url) => (
                <div key={url} className="relative overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                  <img src={url} alt="existing" className="h-24 w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setExistingImageUrls((prev) => prev.filter((item) => item !== url))}
                    className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-red-500 hover:bg-white"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedFiles.length > 0 && (
          <p className="text-xs text-gray-500">ไฟล์ใหม่ที่เลือก: {selectedFiles.length} รูป</p>
        )}

        {existingImageUrls.length === 0 && selectedFiles.length === 0 && (
          <p className="text-sm text-gray-500">ยังไม่มีรูปภาพ</p>
        )}
      </div>

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
