"use client";

import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { GalleryImageManager } from "@/components/gallery/gallery-image-manager";
import { createGalleryAlbumAction, updateGalleryAlbumAction } from "./actions";

const schema = z.object({ title: z.string().min(2, "กรุณาระบุชื่ออัลบั้ม"), description: z.string().optional(), albumDate: z.string().min(1, "กรุณาระบุวันที่อัลบั้ม"), coverUrl: z.string().optional(), isPublic: z.string().min(1), allowResidentSubmissions: z.string().min(1) });
type FormData = z.infer<typeof schema>;
type Props = { mode: "create" | "edit"; albumId?: string; defaultValues?: { title: string; description: string; albumDate: string; coverUrl: string; isPublic: string; allowResidentSubmissions: string } };

export function AlbumForm({ mode, albumId, defaultValues }: Props) {
  const router = useRouter();
  const { register, handleSubmit, setError, control, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: defaultValues ?? { title: "", description: "", albumDate: "", coverUrl: "", isPublic: "PUBLIC", allowResidentSubmissions: "DISALLOW" } });
  const onSubmit = async (data: FormData) => {
    if (mode === "create") { const result = await createGalleryAlbumAction(data); if (!result.success) { setError("root", { message: result.error }); return; } router.push(`/admin/gallery/${result.id}?success=created`); }
    else { const result = await updateGalleryAlbumAction(albumId ?? "", data); if (!result.success) { setError("root", { message: result.error }); return; } router.push(`/admin/gallery/${albumId}?success=updated`); }
    router.refresh();
  };
  return <form onSubmit={handleSubmit(onSubmit)} className="min-w-0 space-y-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
    <Input label="ชื่ออัลบั้ม" {...register("title")} error={errors.title?.message}/><Textarea label="คำอธิบาย" {...register("description")} error={errors.description?.message} rows={4}/>
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2"><Input label="วันที่อัลบั้ม" type="date" {...register("albumDate")} error={errors.albumDate?.message}/><Select label="การมองเห็น" {...register("isPublic")} options={[{ value: "PUBLIC", label: "สาธารณะ" }, { value: "RESIDENT", label: "เฉพาะลูกบ้าน" }]} error={errors.isPublic?.message}/></div>
    <Controller name="coverUrl" control={control} render={({ field }) => <GalleryImageManager label="รูปหน้าปก (ไม่บังคับ)" maxCount={1} disabled={isSubmitting} value={field.value ? [{ id: "cover", url: field.value, description: "" }] : []} onChange={(items) => field.onChange(items[0]?.url ?? "")}/>}/>
    <Select label="สิทธิ์ให้ลูกบ้านขอเพิ่มรูป" {...register("allowResidentSubmissions")} options={[{ value: "ALLOW", label: "อนุญาตให้ส่งคำขอเพิ่มรูป" }, { value: "DISALLOW", label: "ไม่อนุญาต" }]} error={errors.allowResidentSubmissions?.message}/>
    {errors.root && <p role="alert" className="text-sm text-red-600">{errors.root.message}</p>}<div className="flex flex-col gap-3 sm:flex-row"><Button type="submit" isLoading={isSubmitting} className="w-full sm:w-auto">{mode === "create" ? "บันทึกอัลบั้ม" : "บันทึกการแก้ไข"}</Button><Button type="button" variant="outline" onClick={() => router.back()} className="w-full sm:w-auto">ย้อนกลับ</Button></div>
  </form>;
}
