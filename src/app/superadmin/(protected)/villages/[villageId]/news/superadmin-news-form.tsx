"use client";

import { useRef, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { ActionReasonDialog } from "@/components/admin/action-reason-dialog";
import { NewsImageManager, type NewsImageItem } from "@/components/news/news-image-manager";
import { superAdminCreateNewsAction, superAdminUpdateNewsAction } from "./actions";

const schema = z.object({ title: z.string().trim().min(3, "กรุณาระบุหัวข้อข่าว"), summary: z.string().optional(), content: z.string().trim().min(10, "กรุณาระบุเนื้อหาอย่างน้อย 10 ตัวอักษร"), isPublic: z.boolean(), isPinned: z.boolean() });
type FormData = z.infer<typeof schema>;
type Props = { villageId: string; mode: "create" | "edit"; newsId?: string; stage?: "DRAFT" | "PUBLISHED" | "ARCHIVED"; defaultValues?: { title: string; summary: string; content: string; images: NewsImageItem[]; visibility: string; isPinned: boolean } };

function SettingSwitch({ label, helper, registration }: { label: string; helper: string; registration: UseFormRegisterReturn }) {
  return <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-gray-200 px-4 py-3 transition hover:border-gray-300"><span><span className="block text-sm font-medium text-gray-900">{label}</span><span className="mt-1 block text-xs leading-5 text-gray-500">{helper}</span></span><span className="relative mt-0.5 inline-flex shrink-0"><input type="checkbox" className="peer sr-only" {...registration} /><span aria-hidden className="h-6 w-11 rounded-full bg-gray-200 transition peer-checked:bg-green-700 peer-focus-visible:ring-2 peer-focus-visible:ring-green-500 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition peer-checked:after:translate-x-5" /></span></label>;
}

export function SuperAdminNewsForm({ villageId, mode, newsId, stage, defaultValues }: Props) {
  const router = useRouter(); const toast = useToast(); const submitting = useRef(false);
  const [images, setImages] = useState<NewsImageItem[]>(defaultValues?.images ?? []); const [uploadsBusy, setUploadsBusy] = useState(false); const [pendingData, setPendingData] = useState<{ data: FormData; stage: "DRAFT" | "PUBLISHED" | "ARCHIVED" } | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { title: defaultValues?.title ?? "", summary: defaultValues?.summary ?? "", content: defaultValues?.content ?? "", isPublic: defaultValues?.visibility !== "RESIDENT_ONLY", isPinned: defaultValues?.isPinned ?? false } });
  const begin = (desiredStage: "DRAFT" | "PUBLISHED" | "ARCHIVED") => (data: FormData) => { if (!uploadsBusy && !submitting.current) setPendingData({ data, stage: desiredStage }); };
  const confirm = async (reason: string) => {
    if (!pendingData || submitting.current) return;
    submitting.current = true;
    const payload = { title: pendingData.data.title, summary: pendingData.data.summary, content: pendingData.data.content, images, visibility: pendingData.data.isPublic ? "PUBLIC" : "RESIDENT_ONLY", isPinned: pendingData.data.isPinned, stage: pendingData.stage };
    try {
      const result = mode === "create" ? await superAdminCreateNewsAction(villageId, payload, reason) : await superAdminUpdateNewsAction(villageId, newsId ?? "", payload, reason);
      if (!result.success) { toast.error(result.error); return; }
      toast.success(mode === "create" ? "สร้างข่าวเรียบร้อยแล้ว" : "บันทึกการแก้ไขข่าวเรียบร้อยแล้ว");
      router.replace(`/superadmin/villages/${villageId}/news/${result.newsId ?? newsId}`);
    } catch { toast.error("ไม่สามารถบันทึกข่าวได้ กรุณาลองใหม่อีกครั้ง"); }
    finally { submitting.current = false; setPendingData(null); }
  };
  const submitFor = (desiredStage: "DRAFT" | "PUBLISHED") => (event: MouseEvent<HTMLButtonElement>) => { event.preventDefault(); void handleSubmit(begin(desiredStage))(); };
  const back = `/superadmin/villages/${villageId}/news${mode === "edit" ? `/${newsId}` : ""}`;
  return <><form onSubmit={handleSubmit(begin(stage ?? "DRAFT"))} className="space-y-6 rounded-xl border border-gray-200 bg-white p-4 sm:p-6"><section className="space-y-4"><Input label="หัวข้อข่าว" {...register("title")} error={errors.title?.message} placeholder="หัวข้อข่าว..." /><Input label="สรุปข่าว (ไม่บังคับ)" {...register("summary")} error={errors.summary?.message} placeholder="สรุปสั้น ๆ สำหรับหน้ารายการ" /><Textarea label="เนื้อหา" {...register("content")} error={errors.content?.message} placeholder="เนื้อหาข่าว..." rows={10} /></section><NewsImageManager value={images} onChange={setImages} onBusyChange={setUploadsBusy} disabled={isSubmitting} /><section className="space-y-3 border-t border-gray-100 pt-6"><h2 className="font-semibold text-gray-900">การแสดงผล</h2><SettingSwitch label="เผยแพร่สาธารณะ" helper="เปิดเพื่อให้บุคคลทั่วไปสามารถเห็นข่าวนี้ได้" registration={register("isPublic")} /><SettingSwitch label="ปักหมุดข่าว" helper="แสดงข่าวนี้เด่นกว่าข่าวทั่วไป" registration={register("isPinned")} /></section><div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:items-center"><Button type="button" variant="outline" onClick={() => router.push(back)}>ยกเลิก</Button>{mode === "create" ? <><Button type="button" variant="outline" disabled={uploadsBusy || isSubmitting} onClick={submitFor("DRAFT")}>บันทึกร่าง</Button><Button type="button" disabled={uploadsBusy || isSubmitting} isLoading={isSubmitting} onClick={submitFor("PUBLISHED")}>เผยแพร่</Button></> : <Button type="submit" disabled={uploadsBusy || isSubmitting} isLoading={isSubmitting}>บันทึกการแก้ไข</Button>}</div></form><ActionReasonDialog open={Boolean(pendingData)} action="content.archive" title={mode === "create" ? "ยืนยันการสร้างข่าว" : "ยืนยันการแก้ไขข่าว"} description="การดำเนินการนี้จะถูกบันทึกใน Audit Log และแจ้งผู้ดูแลหมู่บ้าน" submitLabel="ยืนยัน" reasonLabel="เหตุผลในการดำเนินการ" helperText="ระบุเหตุผลที่ผู้ดูแลระบบระดับสูงดำเนินการแทนผู้ดูแลหมู่บ้าน" requireReason minReasonLength={5} maxReasonLength={500} loading={isSubmitting} onCancel={() => setPendingData(null)} onSubmit={confirm} /></>;
}
