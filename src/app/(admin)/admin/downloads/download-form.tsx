"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/ui/file-upload";
import { DOWNLOAD_STAGE_LABELS, NEWS_VISIBILITY_LABELS } from "@/lib/constants";
import { createDownloadAction, updateDownloadAction } from "./actions";

const schema = z.object({
  title: z.string().min(3, "กรุณาระบุชื่อเอกสาร"),
  description: z.string().optional(),
  category: z.string().optional(),
  stage: z.string().min(1, "กรุณาเลือกสถานะ"),
  visibility: z.string().min(1, "กรุณาเลือกการมองเห็น"),
});

type FormData = z.infer<typeof schema>;

type DownloadFormProps = {
  mode: "create" | "edit";
  fileId?: string;
  defaultValues?: {
    title: string;
    description: string;
    category: string;
    stage: string;
    visibility: string;
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

export function DownloadForm({ mode, fileId, defaultValues }: DownloadFormProps) {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
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
      category: "",
      stage: "DRAFT",
      visibility: "PUBLIC",
    },
  });

  const stageOptions = Object.entries(DOWNLOAD_STAGE_LABELS).map(([value, label]) => ({ value, label }));
  const visibilityOptions = Object.entries(NEWS_VISIBILITY_LABELS).map(([value, label]) => ({ value, label }));

  const onSubmit = async (data: FormData) => {
    let filePayload: {
      fileName?: string;
      mimeType?: string;
      fileSize?: number;
      fileDataUrl?: string;
    } = {};

    if (selectedFile) {
      try {
        const fileDataUrl = await fileToDataUrl(selectedFile);
        filePayload = {
          fileName: selectedFile.name,
          mimeType: selectedFile.type,
          fileSize: selectedFile.size,
          fileDataUrl,
        };
      } catch {
        setError("root", { message: "ไม่สามารถอ่านไฟล์ที่อัปโหลดได้" });
        return;
      }
    }

    const payload = {
      title: data.title,
      description: data.description,
      category: data.category,
      stage: data.stage,
      visibility: data.visibility,
      ...filePayload,
    };

    if (mode === "create") {
      const result = await createDownloadAction(payload);
      if (!result.success) {
        setError("root", { message: result.error });
        return;
      }
      router.push(`/admin/downloads/${result.id}`);
    } else {
      const result = await updateDownloadAction(fileId ?? "", payload);
      if (!result.success) {
        setError("root", { message: result.error });
        return;
      }
      router.push(`/admin/downloads/${fileId}`);
    }

    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <Input label="ชื่อเอกสาร" {...register("title")} error={errors.title?.message} />
      <Textarea label="รายละเอียดเอกสาร" {...register("description")} error={errors.description?.message} rows={4} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input label="หมวดหมู่" {...register("category")} error={errors.category?.message} />
        <Select label="สถานะ" {...register("stage")} options={stageOptions} error={errors.stage?.message} />
        <Select
          label="การมองเห็น"
          {...register("visibility")}
          options={visibilityOptions}
          error={errors.visibility?.message}
        />
      </div>

      <FileUpload
        label={mode === "create" ? "อัปโหลดเอกสาร" : "อัปโหลดเอกสารใหม่ (ถ้าต้องการแทนที่)"}
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png"
        maxSize={10 * 1024 * 1024}
        onFilesChange={(files) => setSelectedFile(files[0] ?? null)}
      />

      {errors.root && <p className="text-sm text-red-600">{errors.root.message}</p>}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" isLoading={isSubmitting}>
          {mode === "create" ? "บันทึกเอกสาร" : "บันทึกการแก้ไข"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          ย้อนกลับ
        </Button>
      </div>
    </form>
  );
}
