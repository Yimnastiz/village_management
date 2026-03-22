"use client";

import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { NEWS_STAGE_LABELS, NEWS_VISIBILITY_LABELS } from "@/lib/constants";
import { createNewsCreateRequestAction, createNewsUpdateRequestAction } from "./actions";

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

type RequestFormProps = {
  mode: "create" | "update";
  targetNewsId?: string;
  defaultValues?: {
    title: string;
    summary: string;
    content: string;
    imageUrls: string[];
    visibility: string;
    stage: string;
    isPinned: boolean;
  };
};

export function NewsRequestForm({ mode, targetNewsId, defaultValues }: RequestFormProps) {
  const router = useRouter();
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
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: resolvedDefaults,
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "imageUrls",
  });

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
      visibility: data.visibility,
      stage: data.stage,
      isPinned: Boolean(data.isPinned),
    };

    const result =
      mode === "create"
        ? await createNewsCreateRequestAction(payload)
        : await createNewsUpdateRequestAction(targetNewsId ?? "", payload);

    if (!result.success) {
      setError("root", { message: result.error });
      return;
    }

    router.push("/resident/news/requests");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <Input label="หัวข้อข่าว" {...register("title")} error={errors.title?.message} />
      <Input label="สรุปข่าว" {...register("summary")} error={errors.summary?.message} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select
          label="การแสดงผล"
          {...register("visibility")}
          options={visibilityOptions}
          error={errors.visibility?.message}
        />
        <Select
          label="สถานะที่ต้องการ"
          {...register("stage")}
          options={stageOptions}
          error={errors.stage?.message}
        />
      </div>

      <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700">
        <input type="checkbox" {...register("isPinned")} />
        ขอปักหมุดข่าว
      </label>

      <Textarea label="เนื้อหา" {...register("content")} error={errors.content?.message} rows={10} />

      <div className="space-y-3 rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-800">รูปภาพประกอบข่าว</p>
          <Button type="button" variant="outline" size="sm" onClick={() => append({ url: "" })}>
            <Plus className="h-4 w-4 mr-1" /> เพิ่มรูป
          </Button>
        </div>

        {fields.map((field, index) => (
          <div key={field.id} className="flex items-start gap-2">
            <Input
              label={`URL รูปที่ ${index + 1}`}
              placeholder="https://..."
              {...register(`imageUrls.${index}.url`)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-7"
              onClick={() => remove(index)}
              disabled={fields.length <= 1}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      {errors.root && <p className="text-sm text-red-600">{errors.root.message}</p>}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" isLoading={isSubmitting}>
          {mode === "create" ? "ส่งคำขอเพิ่มข่าว" : "ส่งคำขอแก้ไขข่าว"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          ย้อนกลับ
        </Button>
      </div>
    </form>
  );
}
