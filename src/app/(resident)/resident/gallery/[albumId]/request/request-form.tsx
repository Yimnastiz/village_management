"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { GalleryImageDraft, GalleryImageManager } from "@/components/gallery/gallery-image-manager";
import { createGalleryItemSubmissionAction } from "../../actions";
const schema = z.object({ note: z.string().max(500, "ข้อความถึงแอดมินยาวเกินไป").optional() }); type FormData = z.infer<typeof schema>;
export function GallerySubmissionForm({ albumId }: { albumId: string }) {
 const router = useRouter(); const [images, setImages] = useState<GalleryImageDraft[]>([]); const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { note: "" } });
 const submit = async (data: FormData) => { if (!images.length) { setError("root", { message: "กรุณาเพิ่มรูปภาพอย่างน้อย 1 รูป" }); return; } const result = await createGalleryItemSubmissionAction(albumId, { note: data.note, items: images.map((image) => ({ fileUrl: image.url, title: image.description })) }); if (!result.success) { setError("root", { message: result.error }); return; } router.push(`/resident/gallery/${albumId}?submitted=${result.ids.length}`); router.refresh(); };
 return <form onSubmit={handleSubmit(submit)} className="min-w-0 space-y-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-6"><GalleryImageManager value={images} onChange={setImages} disabled={isSubmitting} label="รูปภาพที่ต้องการส่ง"/><Textarea label="ข้อความถึงแอดมิน (ไม่บังคับ)" rows={4} {...register("note")} error={errors.note?.message}/>{errors.root && <p role="alert" className="text-sm text-red-600">{errors.root.message}</p>}<div className="flex flex-col gap-3 sm:flex-row"><Button type="submit" isLoading={isSubmitting} className="w-full sm:w-auto">ส่งคำขอเพิ่มรูป</Button><Button type="button" variant="outline" onClick={() => router.back()} className="w-full sm:w-auto">ย้อนกลับ</Button></div></form>;
}
