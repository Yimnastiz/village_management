"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createGalleryAlbumAction, updateGalleryAlbumAction } from "./actions";

const schema = z.object({
  title: z.string().min(2, "กรุณาระบุชื่ออัลบั้ม"),
  description: z.string().optional(),
  coverUrl: z.string().optional(),
  isPublic: z.string().min(1, "กรุณาเลือกการมองเห็น"),
});

type FormData = z.infer<typeof schema>;

type AlbumFormProps = {
  mode: "create" | "edit";
  albumId?: string;
  defaultValues?: {
    title: string;
    description: string;
    coverUrl: string;
    isPublic: string;
  };
};

export function AlbumForm({ mode, albumId, defaultValues }: AlbumFormProps) {
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
      description: "",
      coverUrl: "",
      isPublic: "PUBLIC",
    },
  });

  const onSubmit = async (data: FormData) => {
    if (mode === "create") {
      const result = await createGalleryAlbumAction(data);
      if (!result.success) {
        setError("root", { message: result.error });
        return;
      }
      router.push(`/admin/gallery/${result.id}`);
    } else {
      const result = await updateGalleryAlbumAction(albumId ?? "", data);
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
      <Input label="ชื่ออัลบั้ม" {...register("title")} error={errors.title?.message} />
      <Textarea label="คำอธิบาย" {...register("description")} error={errors.description?.message} rows={4} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="URL รูปหน้าปก"
          placeholder="https://..."
          {...register("coverUrl")}
          error={errors.coverUrl?.message}
        />
        <Select
          label="การมองเห็น"
          {...register("isPublic")}
          options={[
            { value: "PUBLIC", label: "สาธารณะ" },
            { value: "RESIDENT", label: "เฉพาะลูกบ้าน" },
          ]}
          error={errors.isPublic?.message}
        />
      </div>

      {errors.root && <p className="text-sm text-red-600">{errors.root.message}</p>}

      <div className="flex gap-3">
        <Button type="submit" isLoading={isSubmitting}>
          {mode === "create" ? "บันทึกอัลบั้ม" : "บันทึกการแก้ไข"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          ย้อนกลับ
        </Button>
      </div>
    </form>
  );
}
