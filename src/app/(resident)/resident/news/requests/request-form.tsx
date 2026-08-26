"use client";

import { useState } from "react";
import Link from "next/link";
import { Globe2, Users } from "lucide-react";
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

const REQUESTED_VISIBILITIES: readonly string[] = ["PUBLIC", "RESIDENT_ONLY"];

const schema = z.object({
  title: z.string().min(3, "กรุณาระบุหัวข้อข่าว"),
  summary: z.string().optional(),
  content: z.string().min(10, "กรุณาระบุเนื้อหาอย่างน้อย 10 ตัวอักษร"),
  visibility: z.string().min(1, "กรุณาเลือกการมองเห็นที่ต้องการ").refine((value: string) => REQUESTED_VISIBILITIES.includes(value), "กรุณาเลือกการมองเห็นที่ต้องการ"),
});

type FormData = z.infer<typeof schema>;

type RequestFormProps = {
  mode: "create" | "update" | "submission-edit";
  targetNewsId?: string;
  submissionId?: string;
  cancelHref?: string;
  successHref?: string;
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

function isRequestedVisibility(value: string | undefined): value is "PUBLIC" | "RESIDENT_ONLY" {
  return value === "PUBLIC" || value === "RESIDENT_ONLY";
}

export function NewsRequestForm({ mode, targetNewsId, submissionId, cancelHref = "/resident/news/requests", successHref = "/resident/news/requests", defaultValues }: RequestFormProps) {
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
        visibility: isRequestedVisibility(defaultValues.visibility) ? defaultValues.visibility : "",
      }
    : {
        title: "",
        summary: "",
        content: "",
        visibility: "",
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
      visibility: data.visibility,
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

    router.push(successHref);
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
      <div className="flex justify-end -mb-1"><FormInfoPopover label="เกี่ยวกับการส่งคำขอ">ข่าวที่ส่งจะเข้าสู่คิวรอตรวจสอบ ผู้ดูแลหมู่บ้านจะเป็นผู้อนุมัติก่อนเผยแพร่</FormInfoPopover></div>
      <Input label="หัวข้อข่าว" required {...register("title")} error={errors.title?.message} />
      <Input label="สรุปข่าว" {...register("summary")} error={errors.summary?.message} />
      <Textarea label="เนื้อหา" required {...register("content")} error={errors.content?.message} rows={10} />

      <fieldset aria-describedby="news-request-visibility-helper" aria-invalid={Boolean(errors.visibility)}>
        <legend className="text-sm font-medium text-gray-700">การมองเห็นที่ต้องการ <span className="text-red-500">*</span></legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="flex min-h-12 cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 has-[:checked]:border-green-600 has-[:checked]:bg-green-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-green-500"><input type="radio" value="PUBLIC" className="sr-only" {...register("visibility")} /><Globe2 className="h-4 w-4 text-gray-500" aria-hidden="true" />สาธารณะ</label>
          <label className="flex min-h-12 cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 has-[:checked]:border-green-600 has-[:checked]:bg-green-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-green-500"><input type="radio" value="RESIDENT_ONLY" className="sr-only" {...register("visibility")} /><Users className="h-4 w-4 text-gray-500" aria-hidden="true" />เฉพาะลูกบ้าน</label>
        </div>
        <p id="news-request-visibility-helper" className="mt-2 text-xs text-gray-500">ผู้ดูแลหมู่บ้านสามารถปรับการมองเห็นก่อนอนุมัติได้</p>
        {errors.visibility ? <p className="mt-1 text-sm text-red-600">{errors.visibility.message}</p> : null}
      </fieldset>

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
