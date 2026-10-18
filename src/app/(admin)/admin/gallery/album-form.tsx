"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { GalleryImageManager, type GalleryImageDraft } from "@/components/gallery/gallery-image-manager";
import { createGalleryAlbumAction, saveGalleryAlbumEditAction } from "./actions";
import { galleryTitleSchema } from "@/lib/public-content-validation";

const schema = z.object({
  title: galleryTitleSchema,
  description: z.string().optional(),
  albumDate: z.string().min(1, "กรุณาระบุวันที่อัลบั้ม"),
  isPublicToggle: z.boolean(),
  allowResidentSubmissionsToggle: z.boolean(),
});

type FormData = z.infer<typeof schema>;
type Props = {
  mode: "create" | "edit";
  albumId?: string;
  defaultValues?: {
    title: string;
    description: string;
    albumDate: string;
    isPublic: "PUBLIC" | "RESIDENT";
    allowResidentSubmissions: "ALLOW" | "DISALLOW";
  };
  initialItems?: GalleryImageDraft[];
};

function SettingSwitch({ label, helper, registration }: { label: string; helper: string; registration: UseFormRegisterReturn }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-gray-200 px-4 py-3 transition hover:border-gray-300">
      <span>
        <span className="block text-sm font-medium text-gray-900">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-gray-500">{helper}</span>
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input type="checkbox" className="peer sr-only" {...registration} />
        <span aria-hidden className="h-6 w-11 rounded-full bg-gray-200 transition peer-checked:bg-green-700 peer-focus-visible:ring-2 peer-focus-visible:ring-green-500 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition peer-checked:after:translate-x-5" />
      </span>
    </label>
  );
}

export function AlbumForm({ mode, albumId, defaultValues, initialItems = [] }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [images, setImages] = useState<GalleryImageDraft[]>(initialItems);
  const [uploadsBusy, setUploadsBusy] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: defaultValues?.title ?? "",
      description: defaultValues?.description ?? "",
      albumDate: defaultValues?.albumDate ?? "",
      isPublicToggle: defaultValues?.isPublic !== "RESIDENT",
      allowResidentSubmissionsToggle: defaultValues?.allowResidentSubmissions === "ALLOW",
    },
  });

  const onSubmit = async (data: FormData) => {
    const album = {
      title: data.title,
      description: data.description,
      albumDate: data.albumDate,
      isPublic: data.isPublicToggle ? "PUBLIC" as const : "RESIDENT" as const,
      allowResidentSubmissions: data.allowResidentSubmissionsToggle ? "ALLOW" as const : "DISALLOW" as const,
    };
    const result = mode === "create"
      ? await createGalleryAlbumAction(album)
      : await saveGalleryAlbumEditAction(albumId ?? "", {
          album,
          items: images.map((image, index) => ({
            id: image.id,
            url: image.id ? undefined : image.url,
            fileKey: image.fileKey ?? undefined,
            uploadToken: image.uploadToken,
            description: image.description,
            sortOrder: index,
            isCover: image.isCover,
          })),
        });
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(mode === "create" ? "สร้างอัลบั้มเรียบร้อยแล้ว" : "บันทึกการแก้ไขอัลบั้มเรียบร้อยแล้ว");
    router.replace(mode === "create" && "id" in result ? `/admin/gallery/${result.id}` : `/admin/gallery/${albumId}`);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="min-w-0 space-y-6 rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
      <section className="space-y-4">
        <div>
          <h2 className="font-semibold text-gray-900">ข้อมูลอัลบั้ม</h2>
          <p className="mt-1 text-sm text-gray-500">ข้อมูลที่ใช้แสดงกับผู้เข้าชม</p>
        </div>
        <Input label="ชื่ออัลบั้ม" required {...register("title")} error={errors.title?.message} />
        <Textarea label="คำอธิบาย" {...register("description")} error={errors.description?.message} rows={4} />
        <Input label="วันที่อัลบั้ม" required type="date" {...register("albumDate")} error={errors.albumDate?.message} />
      </section>

      <section className="space-y-3 border-t border-gray-100 pt-6">
        <h2 className="font-semibold text-gray-900">การแสดงผล</h2>
        <SettingSwitch
          label="เผยแพร่สาธารณะ"
          helper="เปิดเพื่อให้บุคคลทั่วไปสามารถดูอัลบั้มนี้ได้"
          registration={register("isPublicToggle")}
        />
        <SettingSwitch
          label="เปิดรับคำขอเพิ่มรูปจากสมาชิก"
          helper="เมื่อเปิด สมาชิกสามารถส่งคำขอเพิ่มรูปเข้ามาในอัลบั้มนี้ได้"
          registration={register("allowResidentSubmissionsToggle")}
        />
      </section>

      {mode === "edit" ? (
        <section className="space-y-4 border-t border-gray-100 pt-6">
          <div>
            <h2 className="font-semibold text-gray-900">รูปภาพ</h2>
            <p className="mt-1 text-sm text-gray-500">ลากเพื่อจัดลำดับ ตั้งหน้าปก แก้คำอธิบาย หรือลบรูป แล้วบันทึกครั้งเดียว</p>
          </div>
          <GalleryImageManager value={images} onChange={setImages} onBusyChange={setUploadsBusy} disabled={isSubmitting} maxCount={Math.max(10, initialItems.length)} />
        </section>
      ) : null}

      <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:items-center">
        <Button type="button" variant="outline" onClick={() => router.push(mode === "create" ? "/admin/gallery" : `/admin/gallery/${albumId}`)} className="w-full sm:w-auto">ยกเลิก</Button>
        <Button type="submit" disabled={uploadsBusy || isSubmitting} isLoading={isSubmitting} className="w-full sm:w-auto">{mode === "create" ? "บันทึกอัลบั้ม" : "บันทึกการแก้ไข"}</Button>
      </div>
    </form>
  );
}
