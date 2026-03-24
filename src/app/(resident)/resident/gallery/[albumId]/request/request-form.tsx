"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/ui/file-upload";
import { createGalleryItemSubmissionAction } from "../../actions";

const schema = z.object({
  title: z.string().min(2, "กรุณาระบุหัวข้อรูปภาพ"),
  mimeType: z.string().optional(),
  note: z.string().max(500, "ข้อความประกอบยาวเกินไป").optional(),
});

type FormData = z.infer<typeof schema>;

type RequestFormProps = {
  albumId: string;
};

export function GallerySubmissionForm({ albumId }: RequestFormProps) {
  const router = useRouter();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("ไม่สามารถอ่านไฟล์ได้"));
      reader.readAsDataURL(file);
    });

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      mimeType: "image/jpeg",
      note: "",
    },
  });

  const onSubmit = async (data: FormData) => {
    if (!selectedFiles[0]) {
      setError("root", { message: "กรุณาอัปโหลดรูปภาพ" });
      return;
    }

    let fileUrl = "";
    try {
      fileUrl = await fileToDataUrl(selectedFiles[0]);
    } catch {
      setError("root", { message: "ไม่สามารถอ่านไฟล์รูปที่อัปโหลดได้" });
      return;
    }

    const result = await createGalleryItemSubmissionAction(albumId, {
      title: data.title,
      fileUrl,
      mimeType: selectedFiles[0].type || data.mimeType,
      note: data.note,
    });

    if (!result.success) {
      setError("root", { message: result.error });
      return;
    }

    router.push(`/resident/gallery/${albumId}?submitted=1`);
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
      <Input label="หัวข้อรูปภาพ" {...register("title")} error={errors.title?.message} />
      <FileUpload
        label="อัปโหลดรูปภาพ"
        accept="image/*"
        maxSize={5 * 1024 * 1024}
        onFilesChange={(files) => setSelectedFiles(files.slice(0, 1))}
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input label="Mime type" {...register("mimeType")} error={errors.mimeType?.message} />
      </div>
      <Textarea label="ข้อความถึงแอดมิน (ไม่บังคับ)" rows={4} {...register("note")} error={errors.note?.message} />

      {errors.root && <p className="text-sm text-red-600">{errors.root.message}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" isLoading={isSubmitting}>ส่งคำขอเพิ่มรูป</Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>ย้อนกลับ</Button>
      </div>
    </form>
  );
}
