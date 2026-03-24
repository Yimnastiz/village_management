"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { NEWS_STAGE_LABELS, NEWS_VISIBILITY_LABELS } from "@/lib/constants";
import {
  createNewsCreateRequestAction,
  createNewsUpdateRequestAction,
  updatePendingNewsSubmissionAction,
} from "./actions";
import { FileUpload } from "@/components/ui/file-upload";

const schema = z.object({
  title: z.string().min(3, "กรุณาระบุหัวข้อข่าว"),
  summary: z.string().optional(),
  content: z.string().min(10, "กรุณาระบุเนื้อหาอย่างน้อย 10 ตัวอักษร"),
  visibility: z.string().min(1, "กรุณาเลือกการแสดงผล"),
  stage: z.string().min(1, "กรุณาเลือกสถานะ"),
  isPinned: z.boolean().optional(),
});

type FormData = z.infer<typeof schema>;

type RequestFormProps = {
  mode: "create" | "update" | "submission-edit";
  targetNewsId?: string;
  submissionId?: string;
  defaultValues?: {
    title: string;
    summary: string;
    content: string;
    imageUrls: string[];
    visibility: string;
    stage: string;
    isPinned: boolean;
  };
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("ไม่สามารถอ่านไฟล์ได้"));
    reader.readAsDataURL(file);
  });
}

function normalizeExistingImageUrls(imageUrls: string[]) {
  return imageUrls.filter((url) => url.trim().length > 0);
}

export function NewsRequestForm({ mode, targetNewsId, submissionId, defaultValues }: RequestFormProps) {
  const router = useRouter();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>(
    normalizeExistingImageUrls(defaultValues?.imageUrls ?? [])
  );

  const resolvedDefaults: FormData = defaultValues
    ? {
        title: defaultValues.title,
        summary: defaultValues.summary,
        content: defaultValues.content,
        visibility: defaultValues.visibility,
        stage: defaultValues.stage,
        isPinned: defaultValues.isPinned,
      }
    : {
        title: "",
        summary: "",
        content: "",
        visibility: "PUBLIC",
        stage: "DRAFT",
        isPinned: false,
      };

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: resolvedDefaults,
  });

  const visibilityOptions = Object.entries(NEWS_VISIBILITY_LABELS).map(([value, label]) => ({
    value,
    label,
  }));
  const stageOptions = Object.entries(NEWS_STAGE_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

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

    const payload = {
      title: data.title,
      summary: data.summary,
      content: data.content,
      imageUrls: [...existingImageUrls, ...uploadedImageDataUrls],
      visibility: data.visibility,
      stage: data.stage,
      isPinned: Boolean(data.isPinned),
    };

    const result =
      mode === "create"
        ? await createNewsCreateRequestAction(payload)
        : mode === "update"
          ? await createNewsUpdateRequestAction(targetNewsId ?? "", payload)
          : await updatePendingNewsSubmissionAction(submissionId ?? "", payload);

    if (!result.success) {
      setError("root", { message: result.error });
      return;
    }

    router.push("/resident/news/requests");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <Input label="หัวข้อข่าว" {...register("title")} error={errors.title?.message} />
      <Input label="สรุปข่าว" {...register("summary")} error={errors.summary?.message} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select
          label="การแสดงผล"
          {...register("visibility")}
          options={visibilityOptions}
          error={errors.visibility?.message}
        />
        <Select
          label="สถานะที่ต้องการ"
          {...register("stage")}
          options={stageOptions}
          error={errors.stage?.message}
        />
      </div>

      <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700">
        <input type="checkbox" {...register("isPinned")} />
        ขอปักหมุดข่าว
      </label>

      <Textarea label="เนื้อหา" {...register("content")} error={errors.content?.message} rows={10} />

      <div className="space-y-3 rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-gray-800">รูปภาพประกอบข่าว</p>
        </div>

        <FileUpload
          label="อัปโหลดรูปภาพ"
          accept="image/*"
          multiple
          maxSize={5 * 1024 * 1024}
          onFilesChange={(files) => setSelectedFiles(files)}
        />

        {existingImageUrls.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">รูปที่มีอยู่แล้ว (กดลบได้)</p>
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

      <div className="flex flex-wrap gap-3">
        <Button type="submit" isLoading={isSubmitting}>
          {mode === "create"
            ? "บันทึกข่าวใหม่"
            : mode === "update"
              ? "ส่งคำขอแก้ไขข่าว"
              : "บันทึกการแก้ไขคำขอ"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          ย้อนกลับ
        </Button>
      </div>
    </form>
  );
}
