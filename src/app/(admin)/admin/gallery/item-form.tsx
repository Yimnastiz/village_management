"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/ui/file-upload";
import { createGalleryItemAction, updateGalleryItemAction } from "./actions";

const schema = z.object({
  title: z.string().optional(),
  mimeType: z.string().optional(),
  sortOrder: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

type ItemFormProps = {
  mode: "create" | "edit";
  albumId: string;
  itemId?: string;
  defaultValues?: {
    title: string;
    fileUrl: string;
    mimeType: string;
    sortOrder: string;
  };
};

export function ItemForm({ mode, albumId, itemId, defaultValues }: ItemFormProps) {
  const router = useRouter();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrl, setPreviewUrl] = useState(defaultValues?.fileUrl || "");
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? {
      title: "",
      mimeType: "image/jpeg",
      sortOrder: "0",
    },
  });

  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("ไม่สามารถอ่านไฟล์ได้"));
      reader.readAsDataURL(file);
    });

  useEffect(() => {
    if (!selectedFiles[0]) {
      setPreviewUrl(defaultValues?.fileUrl || "");
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(selectedFiles[0]);
    setPreviewUrl(nextPreviewUrl);

    return () => {
      URL.revokeObjectURL(nextPreviewUrl);
    };
  }, [defaultValues?.fileUrl, selectedFiles]);

  const onSubmit = async (data: FormData) => {
    let fileUrl = defaultValues?.fileUrl || "";
    let mimeType = data.mimeType || defaultValues?.mimeType || "";

    if (selectedFiles[0]) {
      try {
        fileUrl = await fileToDataUrl(selectedFiles[0]);
        mimeType = selectedFiles[0].type || mimeType;
      } catch {
        setError("root", { message: "ไม่สามารถอ่านไฟล์รูปที่อัปโหลดได้" });
        return;
      }
    }

    if (!fileUrl) {
      setError("root", { message: "กรุณาอัปโหลดรูปภาพ" });
      return;
    }

    const payload = {
      title: data.title,
      fileUrl,
      mimeType,
      sortOrder: data.sortOrder,
    };

    if (mode === "create") {
      const result = await createGalleryItemAction(albumId, payload);
      if (!result.success) {
        setError("root", { message: result.error });
        return;
      }
      router.push(`/admin/gallery/${albumId}`);
    } else {
      const result = await updateGalleryItemAction(albumId, itemId ?? "", payload);
      if (!result.success) {
        setError("root", { message: result.error });
        return;
      }
      router.push(`/admin/gallery/${albumId}`);
    }

    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <Input label="หัวข้อรูปภาพ" {...register("title")} error={errors.title?.message} />
      <FileUpload
        label={mode === "create" ? "อัปโหลดรูปภาพ" : "อัปโหลดรูปภาพใหม่ (ถ้าต้องการแทนที่)"}
        accept="image/*"
        maxSize={5 * 1024 * 1024}
        onFilesChange={(files) => setSelectedFiles(files.slice(0, 1))}
      />
      {previewUrl && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
          <img src={previewUrl} alt="preview" className="h-64 w-full object-contain" />
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Mime type" {...register("mimeType")} error={errors.mimeType?.message} />
        <Input label="ลำดับการแสดงผล" {...register("sortOrder")} error={errors.sortOrder?.message} inputMode="numeric" />
      </div>

      {errors.root && <p className="text-sm text-red-600">{errors.root.message}</p>}

      <div className="flex gap-3">
        <Button type="submit" isLoading={isSubmitting}>
          {mode === "create" ? "เพิ่มรูปภาพ" : "บันทึกการแก้ไข"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          ย้อนกลับ
        </Button>
      </div>
    </form>
  );
}
