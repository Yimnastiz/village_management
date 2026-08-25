"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type UseFormRegisterReturn } from "react-hook-form";
import { FileText, LoaderCircle, Plus, Trash2, UploadCloud } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { DOWNLOAD_CATEGORY_OPTIONS } from "@/lib/downloads/constants";
import type { DownloadFormInput } from "@/lib/downloads/types";
import { DOWNLOAD_ACCEPT, MAX_DOWNLOAD_ATTACHMENT_BYTES, MAX_DOWNLOAD_ATTACHMENTS, downloadTypeLabel } from "@/lib/download-upload";
import { formatFileSize } from "@/lib/utils";
import { createDownloadAction, updateDownloadAction } from "./actions";

type FormValues = { title: string; description?: string; category: string; categoryLabel?: string; isPublic: boolean };
type Attachment = { localId: string; status: "uploaded" | "uploading" | "error"; error?: string; id?: string; fileName: string; fileKey?: string; fileUrl?: string; fileSize: number; mimeType?: string; uploadToken?: string };

type DownloadFormProps = {
  mode: "create" | "edit";
  fileId?: string;
  defaultValues?: { title: string; description: string; category: string; categoryLabel?: string | null; visibility: "PUBLIC" | "RESIDENT_ONLY" };
  initialAttachments?: Array<{ id: string; fileName: string; fileKey: string | null; fileUrl: string; fileSize: number; mimeType: string | null }>;
};

function localId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`; }

function VisibilitySwitch({ registration, disabled }: { registration: UseFormRegisterReturn; disabled: boolean }) {
  return <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-gray-200 px-4 py-3 transition hover:border-gray-300 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"><span><span className="block text-sm font-medium text-gray-900">เผยแพร่สาธารณะ</span><span className="mt-1 block text-xs leading-5 text-gray-500">เมื่อเปิด บุคคลทั่วไปสามารถเห็นเอกสารนี้ได้</span></span><span className="relative mt-0.5 inline-flex shrink-0"><input type="checkbox" className="peer sr-only" disabled={disabled} {...registration} /><span aria-hidden className="h-6 w-11 rounded-full bg-gray-200 transition peer-checked:bg-green-700 peer-focus-visible:ring-2 peer-focus-visible:ring-green-500 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition peer-checked:after:translate-x-5" /></span></label>;
}

function DownloadAttachmentEditor({ value, onChange, disabled, error }: { value: Attachment[]; onChange: (next: Attachment[]) => void; disabled: boolean; error?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const valueRef = useRef(value);
  useEffect(() => { valueRef.current = value; }, [value]);
  const commit = (next: Attachment[]) => { valueRef.current = next; onChange(next); };
  const addFiles = (files: File[]) => {
    const available = MAX_DOWNLOAD_ATTACHMENTS - valueRef.current.length;
    if (available <= 0) return;
    const next = files.slice(0, available).map((file) => ({ localId: localId(), fileName: file.name, fileSize: file.size, mimeType: file.type, status: "uploading" as const }));
    commit([...valueRef.current, ...next]);
    next.forEach((item, index) => {
      const file = files[index];
      if (!file) return;
      if (file.size <= 0 || file.size > MAX_DOWNLOAD_ATTACHMENT_BYTES) {
        commit(valueRef.current.map((row) => row.localId === item.localId ? { ...row, status: "error", error: "ไฟล์ต้องมีขนาดไม่เกิน 25 MB" } : row));
        return;
      }
      void (async () => {
        try {
          const body = new FormData(); body.set("file", file);
          const response = await fetch("/api/admin/downloads/upload", { method: "POST", body });
          const result = await response.json() as { fileName?: string; fileKey?: string; url?: string; fileSize?: number; mimeType?: string; uploadToken?: string; error?: string };
          if (!response.ok || !result.fileName || !result.fileKey || !result.url || !result.fileSize || !result.mimeType || !result.uploadToken) throw new Error(result.error || "อัปโหลดไม่สำเร็จ");
          commit(valueRef.current.map((row) => row.localId === item.localId ? { ...row, fileName: result.fileName!, fileKey: result.fileKey!, fileUrl: result.url!, fileSize: result.fileSize!, mimeType: result.mimeType!, uploadToken: result.uploadToken!, status: "uploaded" } : row));
        } catch (cause) {
          commit(valueRef.current.map((row) => row.localId === item.localId ? { ...row, status: "error", error: cause instanceof Error ? cause.message : "อัปโหลดไฟล์ไม่สำเร็จ" } : row));
        }
      })();
    });
  };

  const remove = (target: string) => commit(valueRef.current.filter((item) => item.localId !== target));
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-medium text-gray-700">ไฟล์เอกสาร <span aria-hidden="true" className="ml-1 text-red-600">*</span></p><p className="mt-1 text-xs text-gray-500">สูงสุด 25 MB ต่อไฟล์ · ไม่เกิน 5 ไฟล์ · PDF, Office, TXT, CSV, JPG, PNG</p></div><Button type="button" size="sm" variant="outline" disabled={disabled || value.length >= MAX_DOWNLOAD_ATTACHMENTS} onClick={() => inputRef.current?.click()}><Plus className="mr-1 h-4 w-4" />เลือกไฟล์</Button></div>
    <input ref={inputRef} type="file" className="sr-only" accept={DOWNLOAD_ACCEPT} multiple disabled={disabled} onChange={(event) => { addFiles(Array.from(event.target.files ?? [])); event.currentTarget.value = ""; }} />
    {value.length === 0 ? <button type="button" disabled={disabled} onClick={() => inputRef.current?.click()} className="flex min-h-28 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 px-4 text-center text-sm text-gray-600 hover:border-green-500 hover:bg-green-50 disabled:cursor-not-allowed"><UploadCloud className="mb-2 h-7 w-7 text-gray-400" />เพิ่มไฟล์เอกสาร</button> : <ul className="overflow-hidden rounded-xl border border-gray-200 divide-y divide-gray-100">{value.map((item) => <li key={item.localId} className="flex min-w-0 flex-wrap items-center gap-3 px-3 py-3 sm:flex-nowrap sm:px-4"><FileText className="h-5 w-5 shrink-0 text-gray-400" /><div className="min-w-0 flex-1"><p className="break-words text-sm font-medium text-gray-800">{item.fileName}</p><p className={item.status === "error" ? "mt-0.5 text-xs text-rose-600" : "mt-0.5 text-xs text-gray-500"}>{item.status === "uploading" ? "กำลังอัปโหลด..." : item.status === "error" ? item.error : `${downloadTypeLabel(item.mimeType ?? null, item.fileName)} · ${formatFileSize(item.fileSize ?? 0)}`}</p></div>{item.status === "uploading" ? <LoaderCircle className="h-5 w-5 shrink-0 animate-spin text-green-600" /> : null}{item.id ? <a href={`/api/downloads/${item.id}`} className="inline-flex min-h-11 items-center px-2 text-sm text-green-700 hover:underline">ดาวน์โหลด</a> : null}<Button type="button" variant="ghost" size="sm" className="min-h-11 min-w-11 px-2 text-rose-600 hover:bg-rose-50 hover:text-rose-700" disabled={disabled} onClick={() => remove(item.localId)} aria-label={`ลบ ${item.fileName}`}><Trash2 className="h-4 w-4" /></Button></li>)}</ul>}
    {error ? <p className="text-xs text-red-600">{error}</p> : null}
  </div>;
}

export function DownloadForm({ mode, fileId, defaultValues, initialAttachments = [] }: DownloadFormProps) {
  const router = useRouter();
  const toast = useToast();
  const [attachments, setAttachments] = useState<Attachment[]>(() => initialAttachments.map((item) => ({ id: item.id, fileName: item.fileName, fileKey: item.fileKey ?? undefined, fileUrl: item.fileUrl, fileSize: item.fileSize, mimeType: item.mimeType ?? undefined, localId: item.id, status: "uploaded" })));
  const submitStage = useRef<"DRAFT" | "PUBLISHED">("DRAFT");
  const { register, handleSubmit, watch, setError, setValue, formState: { errors, isSubmitting } } = useForm<FormValues>({ defaultValues: { title: defaultValues?.title ?? "", description: defaultValues?.description ?? "", category: defaultValues?.category ?? "", categoryLabel: defaultValues?.categoryLabel ?? "", isPublic: defaultValues?.visibility !== "RESIDENT_ONLY" } });
  const category = watch("category");
  const uploadsBusy = attachments.some((item) => item.status === "uploading");

  const applyErrors = (result: { error: string; fieldErrors?: Record<string, string> }) => {
    if (result.fieldErrors) Object.entries(result.fieldErrors).forEach(([name, message]) => { if (name !== "attachments") setError(name as keyof FormValues, { message }); });
    toast.error("บันทึกไม่สำเร็จ", result.error);
  };

  const onSubmit = async (data: FormValues) => {
    if (uploadsBusy) return;
    const attachmentError = attachments.find((item) => item.status !== "uploaded");
    if (attachmentError || !attachments.length) { setError("root", { message: attachmentError?.error || "กรุณาเพิ่มไฟล์เอกสาร" }); return; }
    const payload: DownloadFormInput = { title: data.title, description: data.description, category: data.category, categoryLabel: data.categoryLabel, visibility: data.isPublic ? "PUBLIC" : "RESIDENT_ONLY", attachments: attachments.map(({ localId: _localId, status: _status, error: _error, ...item }) => item) };
    const result = mode === "create" ? await createDownloadAction(payload, submitStage.current) : await updateDownloadAction(fileId ?? "", payload);
    if (!result.success) { applyErrors(result); return; }
    if (mode === "create") { toast.success(submitStage.current === "PUBLISHED" ? "เผยแพร่เอกสารเรียบร้อยแล้ว" : "บันทึกร่างเรียบร้อยแล้ว"); router.push(`/admin/downloads/${result.id}`); }
    else { toast.success("บันทึกการแก้ไขเรียบร้อยแล้ว"); router.push(`/admin/downloads/${fileId}`); }
    router.refresh();
  };

  return <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
    <Input label="ชื่อเอกสาร" required {...register("title")} error={errors.title?.message} />
    <Textarea label="รายละเอียดเอกสาร" {...register("description")} error={errors.description?.message} rows={8} />
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><Select label="หมวดหมู่" required {...register("category", { onChange: (event) => { if (event.target.value !== "OTHER") setValue("categoryLabel", ""); } })} placeholder="เลือกหมวดหมู่" options={DOWNLOAD_CATEGORY_OPTIONS.map((option) => ({ ...option }))} error={errors.category?.message} /><VisibilitySwitch registration={register("isPublic")} disabled={isSubmitting} /></div>
    {category === "OTHER" ? <Input label="ระบุหมวดหมู่" required {...register("categoryLabel")} error={errors.categoryLabel?.message} /> : null}
    <DownloadAttachmentEditor value={attachments} onChange={setAttachments} disabled={isSubmitting} error={errors.root?.message} />
    <div className="flex flex-col-reverse gap-3 border-t border-gray-200 pt-5 sm:flex-row sm:items-center"><Button type="button" variant="outline" className="w-full sm:w-auto" disabled={isSubmitting} onClick={() => router.push(mode === "create" ? "/admin/downloads" : `/admin/downloads/${fileId}`)}>ยกเลิก</Button><div className="flex flex-col gap-3 sm:ml-auto sm:flex-row"><Button type="submit" variant="outline" className="w-full sm:w-auto" disabled={uploadsBusy || isSubmitting} isLoading={isSubmitting} onClick={() => { submitStage.current = "DRAFT" }}>{mode === "create" ? "บันทึกร่าง" : "บันทึกการแก้ไข"}</Button>{mode === "create" ? <Button type="submit" className="w-full sm:w-auto" disabled={uploadsBusy || isSubmitting} isLoading={isSubmitting} onClick={() => { submitStage.current = "PUBLISHED" }}>เผยแพร่</Button> : null}</div></div>
  </form>;
}
