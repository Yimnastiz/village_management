"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createGalleryAlbumAction, updateGalleryAlbumAction } from "./actions";

const schema = z.object({ title: z.string().min(2, "กรุณาระบุชื่ออัลบั้ม"), description: z.string().optional(), albumDate: z.string().min(1, "กรุณาระบุวันที่อัลบั้ม"), coverUrl: z.string().optional(), isPublic: z.string().min(1), allowResidentSubmissions: z.string().min(1) });
type FormData = z.infer<typeof schema>;
type Props = { mode: "create" | "edit"; albumId?: string; defaultValues?: { title: string; description: string; albumDate: string; coverUrl: string; isPublic: string; allowResidentSubmissions: string } };

export function AlbumForm({ mode, albumId, defaultValues }: Props) {
  const router = useRouter();
  const toast = useToast();
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: defaultValues ?? { title: "", description: "", albumDate: "", coverUrl: "", isPublic: "PUBLIC", allowResidentSubmissions: "DISALLOW" } });
  const onSubmit = async (data: FormData) => {
    if (mode === "create") { const result = await createGalleryAlbumAction(data); if (!result.success) { setError("root", { message: result.error }); toast.error(result.error); return; } toast.success("สร้างอัลบั้มเรียบร้อยแล้ว"); router.replace(`/admin/gallery/${result.id}`); }
    else { const result = await updateGalleryAlbumAction(albumId ?? "", data); if (!result.success) { setError("root", { message: result.error }); toast.error(result.error); return; } toast.success("บันทึกการแก้ไขเรียบร้อยแล้ว"); router.replace(`/admin/gallery/${albumId}`); }
  };
  return <form onSubmit={handleSubmit(onSubmit)} className="min-w-0 space-y-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
    <Input label="ชื่ออัลบั้ม *" required aria-required="true" {...register("title")} error={errors.title?.message}/><Textarea label="คำอธิบาย" {...register("description")} error={errors.description?.message} rows={4}/>
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2"><Input label="วันที่อัลบั้ม *" required aria-required="true" type="date" {...register("albumDate")} error={errors.albumDate?.message}/><Select label="การมองเห็น *" required aria-required="true" {...register("isPublic")} options={[{ value: "PUBLIC", label: "สาธารณะ" }, { value: "RESIDENT", label: "เฉพาะลูกบ้าน" }]} error={errors.isPublic?.message}/></div>
    <Select label="สิทธิ์ให้ลูกบ้านขอเพิ่มรูป *" required aria-required="true" {...register("allowResidentSubmissions")} options={[{ value: "ALLOW", label: "อนุญาตให้ส่งคำขอเพิ่มรูป" }, { value: "DISALLOW", label: "ไม่อนุญาต" }]} error={errors.allowResidentSubmissions?.message}/>
    {errors.root && <p role="alert" className="text-sm text-red-600">{errors.root.message}</p>}<div className="flex flex-col gap-3 sm:flex-row"><Button type="submit" isLoading={isSubmitting} className="w-full sm:w-auto">{mode === "create" ? "บันทึกอัลบั้ม" : "บันทึกการแก้ไข"}</Button><Button type="button" variant="outline" onClick={() => router.push(mode === "create" ? "/admin/gallery" : `/admin/gallery/${albumId}`)} className="w-full sm:w-auto">ยกเลิก</Button></div>
  </form>;
}
