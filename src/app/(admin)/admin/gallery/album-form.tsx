"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { GalleryImageManager, type GalleryImageDraft } from "@/components/gallery/gallery-image-manager";
import { createGalleryAlbumAction, saveGalleryAlbumEditAction } from "./actions";

const schema = z.object({
  title: z.string().min(2, "กรุณาระบุชื่ออัลบั้ม"), description: z.string().optional(),
  albumDate: z.string().min(1, "กรุณาระบุวันที่อัลบั้ม"), isPublic: z.string().min(1), allowResidentSubmissions: z.string().min(1),
});
type FormData = z.infer<typeof schema>;
type Props = {
  mode: "create" | "edit"; albumId?: string;
  defaultValues?: { title: string; description: string; albumDate: string; isPublic: string; allowResidentSubmissions: string };
  initialItems?: GalleryImageDraft[];
};

export function AlbumForm({ mode, albumId, defaultValues, initialItems = [] }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [images, setImages] = useState<GalleryImageDraft[]>(initialItems);
  const [uploadsBusy, setUploadsBusy] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? { title: "", description: "", albumDate: "", isPublic: "PUBLIC", allowResidentSubmissions: "DISALLOW" },
  });
  const onSubmit = async (data: FormData) => {
    const result = mode === "create"
      ? await createGalleryAlbumAction(data)
      : await saveGalleryAlbumEditAction(albumId ?? "", { album: data, items: images.map((image, index) => ({ id: image.id, url: image.id ? undefined : image.url, fileKey: image.fileKey ?? undefined, uploadToken: image.uploadToken, description: image.description, sortOrder: index, isCover: image.isCover })) });
    if (!result.success) { toast.error(result.error); return; }
    toast.success(mode === "create" ? "สร้างอัลบั้มเรียบร้อยแล้ว" : "บันทึกการแก้ไขอัลบั้มเรียบร้อยแล้ว");
    router.replace(mode === "create" && "id" in result ? `/admin/gallery/${result.id}` : `/admin/gallery/${albumId}`);
  };

  return <form onSubmit={handleSubmit(onSubmit)} className={mode === "edit" ? "min-w-0 space-y-8" : "min-w-0 space-y-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-6"}>
    <section className={mode === "edit" ? "space-y-4" : "space-y-4"}>
      {mode === "edit" && <div><h2 className="font-semibold text-gray-900">ข้อมูลอัลบั้ม</h2><p className="mt-1 text-sm text-gray-500">ข้อมูลที่ใช้แสดงกับผู้เข้าชม</p></div>}
      <Input label="ชื่ออัลบั้ม" required {...register("title")} error={errors.title?.message}/>
      <Textarea label="คำอธิบาย" {...register("description")} error={errors.description?.message} rows={4}/>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2"><Input label="วันที่อัลบั้ม" required type="date" {...register("albumDate")} error={errors.albumDate?.message}/><Select label="การมองเห็น" required {...register("isPublic")} options={[{ value: "PUBLIC", label: "สาธารณะ" }, { value: "RESIDENT", label: "เฉพาะลูกบ้าน" }]} error={errors.isPublic?.message}/></div>
      <Select label="สิทธิ์ให้ลูกบ้านขอเพิ่มรูป" required {...register("allowResidentSubmissions")} options={[{ value: "ALLOW", label: "อนุญาตให้ส่งคำขอเพิ่มรูป" }, { value: "DISALLOW", label: "ไม่อนุญาต" }]} error={errors.allowResidentSubmissions?.message}/>
    </section>
    {mode === "edit" && <section className="space-y-4 border-t border-gray-200 pt-6"><div><h2 className="font-semibold text-gray-900">จัดการรูปภาพ</h2><p className="mt-1 text-sm text-gray-500">ลากเพื่อจัดลำดับ ตั้งหน้าปก แก้คำอธิบาย หรือลบรูป แล้วบันทึกครั้งเดียว</p></div><GalleryImageManager value={images} onChange={setImages} onBusyChange={setUploadsBusy} disabled={isSubmitting} maxCount={Math.max(10, initialItems.length)} /></section>}
    <div className="flex flex-col-reverse gap-3 border-t border-gray-200 pt-6 sm:flex-row sm:items-center"><Button type="button" variant="outline" onClick={() => router.push(mode === "create" ? "/admin/gallery" : `/admin/gallery/${albumId}`)} className="w-full sm:w-auto">ยกเลิก</Button><Button type="submit" disabled={uploadsBusy || isSubmitting} isLoading={isSubmitting} className="w-full sm:w-auto">{mode === "create" ? "บันทึกอัลบั้ม" : "บันทึกการแก้ไข"}</Button></div>
  </form>;
}
