"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { GalleryImageDraft, GalleryImageManager } from "@/components/gallery/gallery-image-manager";
import { createGalleryItemSubmissionAction } from "../../actions";

const schema = z.object({ note: z.string().max(500, "ข้อความถึงผู้ดูแลยาวเกินไป").optional() });
type FormData = z.infer<typeof schema>;

export function GallerySubmissionForm({ albumId }: { albumId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [images, setImages] = useState<GalleryImageDraft[]>([]);
  const [uploadsBusy, setUploadsBusy] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { note: "" } });
  const submit = async (data: FormData) => {
    if (!images.length) { setImageError("กรุณาเพิ่มรูปภาพอย่างน้อย 1 รูป"); return; }
    setImageError(null);
    const result = await createGalleryItemSubmissionAction(albumId, { note: data.note, items: images.map((image) => ({ url: image.url, fileKey: image.fileKey ?? "", uploadToken: image.uploadToken ?? "", title: image.description })) });
    if (!result.success) { toast.error("ส่งคำขอไม่สำเร็จ", result.error); return; }
    toast.success(result.ids.length > 1 ? `ส่งคำขอเพิ่มรูป ${result.ids.length} รูปเรียบร้อยแล้ว` : "ส่งคำขอเพิ่มรูปเรียบร้อยแล้ว");
    router.replace(`/resident/gallery/${albumId}`);
  };
  return <form onSubmit={handleSubmit(submit)} className="min-w-0 space-y-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-6"><div><GalleryImageManager value={images} onChange={(next) => { setImages(next); if (next.length) setImageError(null); }} onBusyChange={setUploadsBusy} disabled={isSubmitting} maxCount={10} label="รูปภาพ" allowCoverSelection={false} allowReorder={false} />{imageError ? <p role="alert" className="mt-2 text-sm text-red-600">{imageError}</p> : null}</div><Textarea label="ข้อความถึงผู้ดูแล (ไม่บังคับ)" rows={4} {...register("note")} error={errors.note?.message}/><div className="flex flex-col-reverse gap-3 sm:flex-row"><Button type="button" variant="outline" onClick={() => router.push(`/resident/gallery/${albumId}`)} className="w-full sm:w-auto">ยกเลิก</Button><Button type="submit" disabled={uploadsBusy || isSubmitting} isLoading={isSubmitting} className="w-full sm:w-auto">ส่งคำขอเพิ่มรูป</Button></div></form>;
}
