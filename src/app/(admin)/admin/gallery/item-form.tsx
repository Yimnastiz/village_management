"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { GalleryImageDraft, GalleryImageManager } from "@/components/gallery/gallery-image-manager";
import { createGalleryItemsAction, updateGalleryItemAction } from "./actions";
const schema = z.object({ title: z.string().max(500).optional(), sortOrder: z.string().optional() }); type FormData = z.infer<typeof schema>;
type Props = { mode: "create" | "edit"; albumId: string; itemId?: string; hasExistingItems?: boolean; defaultValues?: { title: string; fileUrl: string; mimeType: string; sortOrder: string; isCover?: boolean } };
export function ItemForm({ mode, albumId, itemId, hasExistingItems = false, defaultValues }: Props) {
 const router = useRouter(); const [images, setImages] = useState<GalleryImageDraft[]>(defaultValues?.fileUrl ? [{ id: "existing", url: defaultValues.fileUrl, description: defaultValues.title || "", sortOrder: Number(defaultValues.sortOrder || 0), isCover: Boolean(defaultValues.isCover) }] : []);
 const toast = useToast();
 const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { title: defaultValues?.title || "", sortOrder: defaultValues?.sortOrder || "0" } });
 const submit = async (data: FormData) => { if (!images.length) { setError("root", { message: "กรุณาเพิ่มรูปภาพ" }); return; }
  const result = mode === "create" ? await createGalleryItemsAction(albumId, { items: images.map((image, index) => ({ fileUrl: image.url, title: image.description, isCover: image.isCover, sortOrder: index })) }) : await updateGalleryItemAction(albumId, itemId ?? "", { fileUrl: images[0].url, title: images[0].description || data.title, sortOrder: data.sortOrder, isCover: images[0].isCover });
  if (!result.success) { setError("root", { message: result.error }); toast.error(result.error); return; } const count = "count" in result && typeof result.count === "number" ? result.count : 1; toast.success(mode === "create" ? (count > 1 ? `เพิ่มรูปภาพ ${count} รูปเรียบร้อยแล้ว` : "เพิ่มรูปภาพเรียบร้อยแล้ว") : "บันทึกการแก้ไขเรียบร้อยแล้ว"); router.replace(`/admin/gallery/${albumId}`); };
 return <form onSubmit={handleSubmit(submit)} className="min-w-0 space-y-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
  {mode === "edit" && <Input label="คำอธิบายรูปภาพ" {...register("title")} error={errors.title?.message}/>}<GalleryImageManager value={images} onChange={setImages} maxCount={mode === "create" ? 10 : 1} label={mode === "create" ? "เพิ่มรูปภาพ" : "เปลี่ยนรูปภาพ"} disabled={isSubmitting} autoSelectFirstCover={!hasExistingItems}/>
  {errors.root && <p role="alert" className="text-sm text-red-600">{errors.root.message}</p>}<div className="flex flex-col gap-3 sm:flex-row"><Button type="submit" isLoading={isSubmitting} className="w-full sm:w-auto">{mode === "create" ? "เพิ่มรูปภาพทั้งหมด" : "บันทึกการแก้ไข"}</Button><Button type="button" variant="outline" onClick={() => router.push(`/admin/gallery/${albumId}`)} className="w-full sm:w-auto">ยกเลิก</Button></div>
 </form>;
}
