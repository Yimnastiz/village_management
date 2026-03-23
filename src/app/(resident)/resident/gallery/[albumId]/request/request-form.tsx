"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createGalleryItemSubmissionAction } from "../../actions";

const schema = z.object({
  title: z.string().min(2, "กรุณาระบุหัวข้อรูปภาพ"),
  fileUrl: z.string().url("URL รูปภาพไม่ถูกต้อง"),
  mimeType: z.string().optional(),
  note: z.string().max(500, "ข้อความประกอบยาวเกินไป").optional(),
});

type FormData = z.infer<typeof schema>;

type RequestFormProps = {
  albumId: string;
};

export function GallerySubmissionForm({ albumId }: RequestFormProps) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      fileUrl: "",
      mimeType: "image/jpeg",
      note: "",
    },
  });

  const onSubmit = async (data: FormData) => {
    const result = await createGalleryItemSubmissionAction(albumId, data);

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
      <Input
        label="URL รูปภาพ"
        placeholder="https://..."
        {...register("fileUrl")}
        error={errors.fileUrl?.message}
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
