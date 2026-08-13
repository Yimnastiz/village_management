"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { z } from "zod";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/ui/file-upload";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { VILLAGE_PLACE_CATEGORY_LABELS } from "@/lib/constants";
import { adminCreateVillagePlaceAction, adminUpdateVillagePlaceAction } from "./actions";

const schema = z.object({ name: z.string().trim().min(2, "กรุณาระบุชื่อสถานที่อย่างน้อย 2 ตัวอักษร"), category: z.string(), description: z.string(), address: z.string(), openingHours: z.string(), contactPhone: z.string(), mapUrl: z.string(), latitude: z.string(), longitude: z.string(), isPublic: z.boolean(), isFeatured: z.boolean() });
type FormData = z.infer<typeof schema>;
type PlaceFormProps = { mode: "create" | "edit"; placeId?: string; defaultValues?: Omit<FormData, "isFeatured"> & { isFeatured?: boolean; imageUrls: string[] } };

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || "")); reader.onerror = reject; reader.readAsDataURL(file); });
}

function SettingSwitch({ label, helper, registration }: { label: string; helper: string; registration: UseFormRegisterReturn }) {
  return <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-gray-200 px-4 py-3 transition hover:border-gray-300">
    <span><span className="block text-sm font-medium text-gray-900">{label}</span><span className="mt-1 block text-xs leading-5 text-gray-500">{helper}</span></span>
    <span className="relative mt-0.5 inline-flex shrink-0"><input type="checkbox" className="peer sr-only" {...registration} /><span aria-hidden className="h-6 w-11 rounded-full bg-gray-200 transition peer-checked:bg-green-700 peer-focus-visible:ring-2 peer-focus-visible:ring-green-500 peer-disabled:opacity-50 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition peer-checked:after:translate-x-5" /></span>
  </label>;
}

export function PlaceForm({ mode, placeId, defaultValues }: PlaceFormProps) {
  const router = useRouter(); const toast = useToast();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>(defaultValues?.imageUrls ?? []);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { name: defaultValues?.name ?? "", category: defaultValues?.category ?? "OTHER", description: defaultValues?.description ?? "", address: defaultValues?.address ?? "", openingHours: defaultValues?.openingHours ?? "", contactPhone: defaultValues?.contactPhone ?? "", mapUrl: defaultValues?.mapUrl ?? "", latitude: defaultValues?.latitude ?? "", longitude: defaultValues?.longitude ?? "", isPublic: defaultValues?.isPublic ?? true, isFeatured: defaultValues?.isFeatured ?? false } });
  const onSubmit = async (data: FormData) => {
    let uploadedImageDataUrls: string[] = [];
    try { uploadedImageDataUrls = await Promise.all(selectedFiles.map(fileToDataUrl)); } catch { toast.error("ไม่สามารถอ่านไฟล์รูปภาพได้"); return; }
    const payload = { ...data, imageUrls: [...existingImageUrls, ...uploadedImageDataUrls] };
    if (mode === "create") {
      const result = await adminCreateVillagePlaceAction(payload);
      if (!result.success) { toast.error(result.error); return; }
      toast.success("เพิ่มสถานที่เรียบร้อยแล้ว");
      router.replace(`/admin/places/${result.placeId}`);
      return;
    }
    const result = await adminUpdateVillagePlaceAction(placeId ?? "", payload);
    if (!result.success) { toast.error(result.error); return; }
    toast.success("บันทึกการแก้ไขเรียบร้อยแล้ว");
    router.replace(`/admin/places/${placeId}`);
  };
  return <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
    <section className="space-y-4"><div><h2 className="font-semibold text-gray-900">ข้อมูลสถานที่</h2><p className="mt-1 text-sm text-gray-500">รายละเอียดที่ใช้ค้นหาและแสดงในรายการ</p></div><Input label="ชื่อสถานที่" {...register("name")} error={errors.name?.message} /><div className="grid grid-cols-1 gap-4 md:grid-cols-2"><Select label="หมวดหมู่" {...register("category")} options={Object.entries(VILLAGE_PLACE_CATEGORY_LABELS).map(([value, label]) => ({ value, label }))} error={errors.category?.message} /><Input label="เบอร์โทรติดต่อ" {...register("contactPhone")} error={errors.contactPhone?.message} /></div><Textarea label="รายละเอียด" rows={5} {...register("description")} error={errors.description?.message} /></section>
    <section className="space-y-4 border-t border-gray-100 pt-6"><div><h2 className="font-semibold text-gray-900">ข้อมูลติดต่อและตำแหน่ง</h2></div><Input label="ที่อยู่" {...register("address")} error={errors.address?.message} /><div className="grid grid-cols-1 gap-4 md:grid-cols-2"><Input label="เวลาเปิด-ปิด" placeholder="เช่น ทุกวัน 08:00-17:00" {...register("openingHours")} error={errors.openingHours?.message} /><Input label="ลิงก์แผนที่" placeholder="https://maps.google.com/..." {...register("mapUrl")} error={errors.mapUrl?.message} /></div><div className="grid grid-cols-1 gap-4 md:grid-cols-2"><Input label="Latitude" placeholder="13.7563" {...register("latitude")} error={errors.latitude?.message} /><Input label="Longitude" placeholder="100.5018" {...register("longitude")} error={errors.longitude?.message} /></div></section>
    <section className="space-y-3 border-t border-gray-100 pt-6"><div><h2 className="font-semibold text-gray-900">การแสดงผล</h2></div><SettingSwitch label="เผยแพร่สาธารณะ" helper="เปิดเพื่อให้บุคคลทั่วไปสามารถเห็นสถานที่นี้ได้" registration={register("isPublic")} /><SettingSwitch label="สถานที่สำคัญ" helper="ทำเครื่องหมายสถานที่ที่ควรแสดงเด่นหรือค้นหาได้ง่ายเป็นพิเศษ" registration={register("isFeatured")} /></section>
    <section className="space-y-3 border-t border-gray-100 pt-6"><div><h2 className="font-semibold text-gray-900">รูปภาพ</h2></div><FileUpload label="อัปโหลดรูปภาพ" accept="image/*" multiple maxSize={5 * 1024 * 1024} onFilesChange={setSelectedFiles} />{existingImageUrls.length > 0 && <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{existingImageUrls.map((url) => <div key={url} className="relative overflow-hidden rounded-lg border border-gray-200 bg-gray-50"><img src={url} alt="รูปสถานที่" className="h-24 w-full object-cover" /><button type="button" onClick={() => setExistingImageUrls((items) => items.filter((item) => item !== url))} className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-red-500 hover:bg-white" aria-label="ลบรูปภาพ"><Trash2 className="h-3.5 w-3.5" /></button></div>)}</div>}</section>
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center"><Button type="button" variant="outline" onClick={() => router.back()}>ย้อนกลับ</Button><Button type="submit" isLoading={isSubmitting}>{mode === "create" ? "เพิ่มสถานที่" : "บันทึกการแก้ไข"}</Button></div>
  </form>;
}
