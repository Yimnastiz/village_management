"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { NEWS_STAGE_LABELS, NEWS_VISIBILITY_LABELS } from "@/lib/constants";
import { adminCreateNewsAction, adminUpdateNewsAction } from "./actions";
import { NewsImageManager } from "@/components/news/news-image-manager";
import { MAX_TOTAL_IMAGE_DATA_URL_BYTES } from "@/lib/image-constraints";

const schema = z.object({
  title: z.string().min(3, "กรุณาระบุหัวข้อข่าว"),
  summary: z.string().optional(),
  content: z.string().min(10, "กรุณาระบุเนื้อหาอย่างน้อย 10 ตัวอักษร"),
  imageUrls: z.array(z.object({ url: z.string().optional() })).optional(),
  visibility: z.string().min(1, "กรุณาเลือกการแสดงผล"),
  stage: z.string().min(1, "กรุณาเลือกสถานะ"),
  isPinned: z.boolean().optional(),
});

type FormData = z.infer<typeof schema>;

type NewsFormProps = {
  mode: "create" | "edit";
  newsId?: string;
  defaultValues?: {
    title: string;
    summary: string;
    content: string;
    imageUrls: string[];
    visibility: string;
    stage: string;
    isPinned: boolean;
    coverUrl?: string | null;
  };
};

export function NewsForm({ mode, newsId, defaultValues }: NewsFormProps) {
  const router = useRouter();
  const [coverUrl, setCoverUrl] = useState<string | null>(defaultValues?.coverUrl ?? defaultValues?.imageUrls[0] ?? null);
  const resolvedDefaults: FormData = defaultValues
    ? {
        ...defaultValues,
        imageUrls:
          defaultValues.imageUrls.length > 0
            ? defaultValues.imageUrls.map((url) => ({ url }))
            : [{ url: "" }],
      }
    : {
        title: "",
        summary: "",
        content: "",
        imageUrls: [{ url: "" }],
        visibility: "PUBLIC",
        stage: "DRAFT",
        isPinned: false,
      };

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
    watch,
    setValue,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: resolvedDefaults,
  });

  const imageUrls = (watch("imageUrls") ?? []).map((item) => item.url?.trim() || "").filter(Boolean);

  const visibilityOptions = Object.entries(NEWS_VISIBILITY_LABELS).map(([value, label]) => ({
    value,
    label,
  }));
  const stageOptions = Object.entries(NEWS_STAGE_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  const onSubmit = async (data: FormData) => {
    const payload = {
      title: data.title,
      summary: data.summary,
      content: data.content,
      imageUrls: (data.imageUrls ?? [])
        .map((item) => item.url?.trim() || "")
        .filter((url) => url.length > 0),
      coverUrl,
      visibility: data.visibility,
      stage: data.stage,
      isPinned: Boolean(data.isPinned),
    };

    if (payload.imageUrls.reduce((total, url) => total + new TextEncoder().encode(url).length, 0) > MAX_TOTAL_IMAGE_DATA_URL_BYTES) {
      setError("root", { message: "ขนาดรวมของรูปภาพเกินขีดจำกัดสำหรับการบันทึก กรุณาลดจำนวนหรือเลือกไฟล์ขนาดเล็กลง" });
      return;
    }

    if (mode === "create") {
      const result = await adminCreateNewsAction(payload);
      if (!result.success) {
        setError("root", { message: result.error });
        return;
      }
      router.replace(`/admin/news/${result.newsId}`);
      return;
    } else {
      const result = await adminUpdateNewsAction(newsId ?? "", payload);
      if (!result.success) {
        setError("root", { message: result.error });
        return;
      }
      router.replace(`/admin/news/${newsId}`);
      return;
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="bg-white rounded-xl border border-gray-200 p-6 space-y-4"
    >
      <Input
        label="หัวข้อข่าว"
        {...register("title")}
        error={errors.title?.message}
        placeholder="หัวข้อข่าว..."
      />
      <Input
        label="สรุปข่าว (ไม่บังคับ)"
        {...register("summary")}
        error={errors.summary?.message}
        placeholder="สรุปสั้นๆ สำหรับหน้า list"
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select
          label="การแสดงผล"
          {...register("visibility")}
          options={visibilityOptions}
          error={errors.visibility?.message}
        />
        <Select
          label="สถานะ"
          {...register("stage")}
          options={stageOptions}
          error={errors.stage?.message}
        />
      </div>

      <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700">
        <input type="checkbox" {...register("isPinned")} />
        ปักหมุดข่าว
      </label>

      <Textarea
        label="เนื้อหา"
        {...register("content")}
        error={errors.content?.message}
        placeholder="เนื้อหาข่าว..."
        rows={10}
      />

      <NewsImageManager imageUrls={imageUrls} coverUrl={coverUrl} onCoverChange={setCoverUrl} onChange={(urls) => setValue("imageUrls", urls.map((url) => ({ url })), { shouldDirty: true })} />

      {errors.root && <p className="text-sm text-red-600">{errors.root.message}</p>}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" isLoading={isSubmitting}>
          {mode === "create" ? "บันทึกข่าว" : "บันทึกการแก้ไข"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
        >
          ย้อนกลับ
        </Button>
      </div>
    </form>
  );
}
