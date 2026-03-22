"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createGalleryItemAction, updateGalleryItemAction } from "./actions";

const schema = z.object({
  title: z.string().optional(),
  fileUrl: z.string().url("URL รูปภาพไม่ถูกต้อง"),
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
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? {
      title: "",
      fileUrl: "",
      mimeType: "image/jpeg",
      sortOrder: "0",
    },
  });

  const onSubmit = async (data: FormData) => {
    if (mode === "create") {
      const result = await createGalleryItemAction(albumId, data);
      if (!result.success) {
        setError("root", { message: result.error });
        return;
      }
      router.push(`/admin/gallery/${albumId}`);
    } else {
      const result = await updateGalleryItemAction(albumId, itemId ?? "", data);
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
      <Input label="URL รูปภาพ" {...register("fileUrl")} error={errors.fileUrl?.message} placeholder="https://..." />
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
