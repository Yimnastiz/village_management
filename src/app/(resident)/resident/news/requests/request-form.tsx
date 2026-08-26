"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FormInfoPopover } from "@/components/ui/form-info-popover";
import {
  createNewsCreateRequestAction,
  createNewsUpdateRequestAction,
  updatePendingNewsSubmissionAction,
} from "./actions";
import { NewsImageManager } from "@/components/news/news-image-manager";

const schema = z.object({
  title: z.string().min(3, "กรุณาระบุหัวข้อข่าว"),
  summary: z.string().optional(),
  content: z.string().min(10, "กรุณาระบุเนื้อหาอย่างน้อย 10 ตัวอักษร"),
});

type FormData = z.infer<typeof schema>;

type RequestFormProps = {
  mode: "create" | "update" | "submission-edit";
  targetNewsId?: string;
  submissionId?: string;
  cancelHref?: string;
  defaultValues?: {
    title: string;
    summary: string;
    content: string;
    imageUrls: string[];
    coverUrl?: string | null;
    visibility: string;
    stage: string;
    isPinned: boolean;
  };
};

function normalizeExistingImageUrls(imageUrls: string[]) {
  return imageUrls.filter((url) => url.trim().length > 0);
}

export function NewsRequestForm({ mode, targetNewsId, submissionId, cancelHref = "/resident/news/requests", defaultValues }: RequestFormProps) {
  const router = useRouter();
  const [imageUrls, setImageUrls] = useState<string[]>(
    normalizeExistingImageUrls(defaultValues?.imageUrls ?? [])
  );
  const [coverUrl, setCoverUrl] = useState<string | null>(
    defaultValues?.coverUrl && defaultValues.imageUrls.includes(defaultValues.coverUrl)
      ? defaultValues.coverUrl
      : defaultValues?.imageUrls[0] ?? null,
  );

  const resolvedDefaults: FormData = defaultValues
    ? {
        title: defaultValues.title,
        summary: defaultValues.summary,
        content: defaultValues.content,
      }
    : {
        title: "",
        summary: "",
        content: "",
      };

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: resolvedDefaults,
  });

  const onSubmit = async (data: FormData) => {
    const payload = {
      title: data.title,
      summary: data.summary,
      content: data.content,
      imageUrls,
      coverUrl,
    };

    const result =
      mode === "create"
        ? await createNewsCreateRequestAction(payload)
        : mode === "update"
          ? await createNewsUpdateRequestAction(targetNewsId ?? "", payload)
          : await updatePendingNewsSubmissionAction(submissionId ?? "", payload);

    if (!result.success) {
      setError("root", { message: result.error });
      return;
    }

    router.push("/resident/news/requests");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
      <div className="flex justify-end -mb-1"><FormInfoPopover label="เกี่ยวกับการส่งคำขอ">ข่าวที่ส่งจะเข้าสู่คิวรอตรวจสอบ ผู้ดูแลหมู่บ้านจะเป็นผู้อนุมัติก่อนเผยแพร่</FormInfoPopover></div>
      <Input label="หัวข้อข่าว" required {...register("title")} error={errors.title?.message} />
      <Input label="สรุปข่าว" {...register("summary")} error={errors.summary?.message} />
      <Textarea label="เนื้อหา" required {...register("content")} error={errors.content?.message} rows={10} />

      <NewsImageManager value={imageUrls.map((url, sortOrder) => ({ url, sortOrder, isCover: coverUrl ? url === coverUrl : sortOrder === 0 }))} onChange={(items) => { const urls = items.map((item) => item.url); setImageUrls(urls); setCoverUrl(items.find((item) => item.isCover)?.url ?? urls[0] ?? null); }} />

      {errors.root && <p className="text-sm text-red-600">{errors.root.message}</p>}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" isLoading={isSubmitting}>
          {mode === "create"
            ? "ส่งคำขอเพิ่มข่าว"
            : mode === "update"
              ? "ส่งคำขอแก้ไขข่าว"
              : "บันทึกการแก้ไขคำขอ"}
        </Button>
        <Link href={cancelHref} className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2">ย้อนกลับ</Link>
      </div>
    </form>
  );
}
