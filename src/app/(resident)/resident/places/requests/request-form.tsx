"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { PlaceImageManager } from "@/components/places/place-image-manager";
import { VILLAGE_PLACE_CATEGORY_LABELS } from "@/lib/constants";
import { VILLAGE_PLACE_CATEGORIES } from "@/lib/village-place";
import type { PlaceImageInput, PlaceImageView } from "@/lib/place-image";
import { createVillagePlaceSubmissionAction, createVillagePlaceUpdateSubmissionAction } from "./actions";

const schema = z.object({ name: z.string().trim().min(2, "กรุณาระบุชื่อสถานที่อย่างน้อย 2 ตัวอักษร"), category: z.string().min(1, "กรุณาเลือกหมวดหมู่"), description: z.string(), address: z.string(), openingHours: z.string(), contactPhone: z.string(), mapUrl: z.string(), latitude: z.string(), longitude: z.string() });
type FormData = z.infer<typeof schema>;
type Props = { mode?: "create" | "update"; targetPlaceId?: string; cancelHref: string; defaultValues?: FormData & { images: PlaceImageView[] } };

export function PlaceRequestForm({ mode = "create", targetPlaceId, cancelHref, defaultValues }: Props) {
  const router = useRouter(); const toast = useToast(); const submittingRef = useRef(false);
  const [images, setImages] = useState<PlaceImageInput[]>(() => (defaultValues?.images ?? []).map((image, index) => ({ id: image.id, url: image.id ? undefined : image.url, fileKey: image.fileKey ?? undefined, uploadToken: image.uploadToken, sortOrder: index, isCover: image.isCover }))); const [uploadsBusy, setUploadsBusy] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { name: defaultValues?.name ?? "", category: defaultValues?.category ?? "OTHER", description: defaultValues?.description ?? "", address: defaultValues?.address ?? "", openingHours: defaultValues?.openingHours ?? "", contactPhone: defaultValues?.contactPhone ?? "", mapUrl: defaultValues?.mapUrl ?? "", latitude: defaultValues?.latitude ?? "", longitude: defaultValues?.longitude ?? "" } });
  const onSubmit = async (data: FormData) => {
    if (submittingRef.current || uploadsBusy) return;
    submittingRef.current = true;
    try {
      const payload = { ...data, images };
      const result = mode === "update" ? await createVillagePlaceUpdateSubmissionAction(targetPlaceId ?? "", payload) : await createVillagePlaceSubmissionAction(payload);
      if (!result.success) { toast.error(result.error); return; }
      toast.success(mode === "update" ? "ส่งคำขอแก้ไขสถานที่เรียบร้อยแล้ว" : "ส่งคำขอเพิ่มสถานที่เรียบร้อยแล้ว");
      router.replace("/resident/places/requests");
    } catch (error) {
      console.error("submit place request", error); toast.error("ไม่สามารถส่งคำขอสถานที่ได้ กรุณาลองใหม่อีกครั้ง");
    } finally { submittingRef.current = false; }
  };
  return <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
    <section className="space-y-4"><div><h2 className="font-semibold text-gray-900">ข้อมูลสถานที่</h2><p className="mt-1 text-sm text-gray-500">เลือกหมวดหมู่ที่ใกล้เคียงกับสถานที่มากที่สุด หากไม่พบหมวดที่เหมาะสม ให้เลือก “อื่น ๆ”</p></div><Input label="ชื่อสถานที่" {...register("name")} error={errors.name?.message} /><Select label="หมวดหมู่" {...register("category")} options={VILLAGE_PLACE_CATEGORIES.map((value) => ({ value, label: VILLAGE_PLACE_CATEGORY_LABELS[value] }))} error={errors.category?.message} /><Textarea label="รายละเอียด" rows={5} {...register("description")} error={errors.description?.message} /></section>
    <section className="space-y-4 border-t border-gray-100 pt-6"><h2 className="font-semibold text-gray-900">ข้อมูลติดต่อและตำแหน่ง</h2><div className="grid grid-cols-1 gap-4 md:grid-cols-2"><Input label="เบอร์โทรติดต่อ" {...register("contactPhone")} error={errors.contactPhone?.message} /><Input label="เวลาเปิด-ปิด" placeholder="เช่น ทุกวัน 08:00-17:00" {...register("openingHours")} error={errors.openingHours?.message} /></div><Input label="ที่อยู่" {...register("address")} error={errors.address?.message} /><Input label="ลิงก์แผนที่ (ไม่บังคับ)" placeholder="https://maps.google.com/..." {...register("mapUrl")} error={errors.mapUrl?.message} /><details className="rounded-lg border border-gray-200 px-3 py-2"><summary className="cursor-pointer text-sm font-medium text-gray-700">ข้อมูลพิกัดเพิ่มเติม</summary><div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2"><Input label="Latitude" placeholder="13.7563" {...register("latitude")} error={errors.latitude?.message} /><Input label="Longitude" placeholder="100.5018" {...register("longitude")} error={errors.longitude?.message} /></div></details></section>
    <PlaceImageManager value={defaultValues?.images ?? []} onChange={setImages} onBusyChange={setUploadsBusy} disabled={isSubmitting} />
    <div className="flex flex-col-reverse gap-3 sm:flex-row"><Button type="button" variant="outline" onClick={() => router.push(cancelHref)}>ยกเลิก</Button><Button type="submit" disabled={uploadsBusy || isSubmitting} isLoading={isSubmitting}>{mode === "update" ? "ส่งคำขอแก้ไขสถานที่" : "ส่งคำขอเพิ่มสถานที่"}</Button></div>
  </form>;
}
