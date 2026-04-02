"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FileUpload } from "@/components/ui/file-upload";
import { VILLAGE_PLACE_CATEGORY_LABELS } from "@/lib/constants";
import {
  createVillagePlaceSubmissionAction,
  createVillagePlaceUpdateSubmissionAction,
} from "./actions";

const schema = z.object({
  name: z.string().min(2, "กรุณาระบุชื่อสถานที่"),
  category: z.string().min(1, "กรุณาเลือกหมวดหมู่"),
  description: z.string().optional(),
  address: z.string().optional(),
  openingHours: z.string().optional(),
  contactPhone: z.string().optional(),
  mapUrl: z.string().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  isPublic: z.boolean().optional(),
});

type FormData = z.infer<typeof schema>;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("ไม่สามารถอ่านไฟล์ได้"));
    reader.readAsDataURL(file);
  });
}

type PlaceRequestFormProps = {
  mode?: "create" | "update";
  targetPlaceId?: string;
  defaultValues?: {
    name: string;
    category: string;
    description: string;
    address: string;
    openingHours: string;
    contactPhone: string;
    mapUrl: string;
    latitude: string;
    longitude: string;
    isPublic: boolean;
    imageUrls: string[];
  };
};

export function PlaceRequestForm({ mode = "create", targetPlaceId, defaultValues }: PlaceRequestFormProps) {
  const router = useRouter();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>(defaultValues?.imageUrls ?? []);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      category: defaultValues?.category ?? "OTHER",
      description: defaultValues?.description ?? "",
      address: defaultValues?.address ?? "",
      openingHours: defaultValues?.openingHours ?? "",
      contactPhone: defaultValues?.contactPhone ?? "",
      mapUrl: defaultValues?.mapUrl ?? "",
      latitude: defaultValues?.latitude ?? "",
      longitude: defaultValues?.longitude ?? "",
      isPublic: defaultValues?.isPublic ?? true,
    },
  });

  const onSubmit = async (data: FormData) => {
    let uploadedImageDataUrls: string[] = [];
    if (selectedFiles.length > 0) {
      try {
        uploadedImageDataUrls = await Promise.all(selectedFiles.map((file) => fileToDataUrl(file)));
      } catch {
        setError("root", { message: "ไม่สามารถอ่านไฟล์รูปที่อัปโหลดได้" });
        return;
      }
    }

    const payload = {
      ...data,
      imageUrls: [...existingImageUrls, ...uploadedImageDataUrls],
      isPublic: Boolean(data.isPublic),
    };

    const result =
      mode === "update"
        ? await createVillagePlaceUpdateSubmissionAction(targetPlaceId ?? "", payload)
        : await createVillagePlaceSubmissionAction(payload);

    if (!result.success) {
      setError("root", { message: result.error });
      return;
    }

    router.push("/resident/places/requests?submitted=1");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
      <Input label="ชื่อสถานที่" {...register("name")} error={errors.name?.message} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Select
          label="หมวดหมู่"
          {...register("category")}
          options={Object.entries(VILLAGE_PLACE_CATEGORY_LABELS).map(([value, label]) => ({ value, label }))}
          error={errors.category?.message}
        />
        <Input label="เบอร์โทรติดต่อ" {...register("contactPhone")} error={errors.contactPhone?.message} />
      </div>

      <Input label="ที่อยู่" {...register("address")} error={errors.address?.message} />
      <Input label="เวลาเปิด-ปิด" placeholder="เช่น ทุกวัน 08:00-17:00" {...register("openingHours")} error={errors.openingHours?.message} />
      <Input label="ลิงก์แผนที่ (ถ้ามี)" placeholder="https://maps.google.com/..." {...register("mapUrl")} error={errors.mapUrl?.message} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input label="Latitude" placeholder="13.7563" {...register("latitude")} error={errors.latitude?.message} />
        <Input label="Longitude" placeholder="100.5018" {...register("longitude")} error={errors.longitude?.message} />
      </div>
      <Textarea label="รายละเอียด" rows={5} {...register("description")} error={errors.description?.message} />

      <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700">
        <input type="checkbox" {...register("isPublic")} />
        แสดงในหน้าสาธารณะด้วย (Public Village)
      </label>

      <div className="space-y-3 rounded-xl border border-gray-200 p-4">
        <p className="text-sm font-medium text-gray-800">รูปภาพสถานที่</p>

        <FileUpload
          label="อัปโหลดรูปภาพ"
          accept="image/*"
          multiple
          maxSize={5 * 1024 * 1024}
          onFilesChange={(files) => setSelectedFiles(files)}
        />

        {existingImageUrls.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {existingImageUrls.map((url) => (
              <div key={url} className="relative overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                <img src={url} alt="existing" className="h-24 w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setExistingImageUrls((prev) => prev.filter((item) => item !== url))}
                  className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-red-500 hover:bg-white"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {selectedFiles.length > 0 && (
          <p className="text-xs text-gray-500">ไฟล์ใหม่ที่เลือก: {selectedFiles.length} รูป</p>
        )}
      </div>

      {errors.root && <p className="text-sm text-red-600">{errors.root.message}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" isLoading={isSubmitting}>{mode === "update" ? "ส่งคำขอแก้ไขสถานที่" : "ส่งคำขอเพิ่มสถานที่"}</Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>ย้อนกลับ</Button>
      </div>
    </form>
  );
}
