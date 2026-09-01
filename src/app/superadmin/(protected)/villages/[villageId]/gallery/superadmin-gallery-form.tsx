"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useController, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ActionReasonDialog } from "@/components/admin/action-reason-dialog";
import { GalleryImageManager, type GalleryImageDraft } from "@/components/gallery/gallery-image-manager";
import { useToast } from "@/components/ui/toast";
import { saveSuperAdminGalleryAlbumDataAction, addSuperAdminGalleryItemsDataAction, updateSuperAdminGalleryItemDataAction } from "../operational-actions";

const albumSchema = z.object({ title: z.string().min(2, "กรุณาระบุชื่ออัลบั้ม"), description: z.string().optional(), albumDate: z.string().min(1, "กรุณาระบุวันที่"), isPublic: z.enum(["PUBLIC", "RESIDENT"]), allowResidentSubmissions: z.enum(["ALLOW", "DISALLOW"]) });
type AlbumData = z.infer<typeof albumSchema>;

function SettingSwitch({ label, helper, checked, onChange }: { label: string; helper: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-gray-200 px-4 py-3 transition hover:border-gray-300">
    <span><span className="block text-sm font-medium text-gray-900">{label}</span><span className="mt-1 block text-xs leading-5 text-gray-500">{helper}</span></span>
    <span className="relative mt-0.5 inline-flex shrink-0"><input type="checkbox" className="peer sr-only" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span aria-hidden className="h-6 w-11 rounded-full bg-gray-200 transition peer-checked:bg-green-700 peer-focus-visible:ring-2 peer-focus-visible:ring-green-500 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition peer-checked:after:translate-x-5" /></span>
  </label>;
}

export function SuperAdminAlbumForm({ villageId, albumId, defaultValues, initialItems = [] }: { villageId: string; albumId?: string; defaultValues?: AlbumData; initialItems?: GalleryImageDraft[] }) {
  const router = useRouter(); const toast = useToast(); const [images, setImages] = useState(initialItems); const [busy, setBusy] = useState(false); const [pending, setPending] = useState<AlbumData | null>(null);
  const { register, control, handleSubmit, formState: { errors, isSubmitting } } = useForm<AlbumData>({ resolver: zodResolver(albumSchema), defaultValues: defaultValues ?? { title: "", description: "", albumDate: "", isPublic: "PUBLIC", allowResidentSubmissions: "DISALLOW" } });
  const publicField = useController({ control, name: "isPublic" });
  const submissionsField = useController({ control, name: "allowResidentSubmissions" });
  const confirm = async (supportReason: string) => { if (!pending) return; setBusy(true); const result = await saveSuperAdminGalleryAlbumDataAction(villageId, albumId ?? null, pending, images.map((image, index) => ({ id: image.id.startsWith("gallery-") ? undefined : image.id, url: image.url, fileKey: image.fileKey, uploadToken: image.uploadToken, description: image.description, sortOrder: index, isCover: Boolean(image.isCover) })), supportReason); setBusy(false); if (!result.success) { toast.error(result.error); return; } toast.success(result.message); setPending(null); router.replace(`/superadmin/villages/${villageId}/gallery/${result.id}`); };
  return <><form onSubmit={handleSubmit((data) => setPending(data))} className="min-w-0 space-y-6 rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2"><Input label="ชื่ออัลบั้ม" required {...register("title")} error={errors.title?.message} /><Input label="วันที่อัลบั้ม" required type="date" {...register("albumDate")} error={errors.albumDate?.message} /></div>
    <Textarea label="คำอธิบาย" {...register("description")} error={errors.description?.message} rows={4} />
    <section className="space-y-3 border-t border-gray-100 pt-6"><h2 className="font-semibold text-gray-900">การแสดงผล</h2><SettingSwitch label="เผยแพร่สาธารณะ" helper="เปิดเพื่อให้บุคคลทั่วไปสามารถเห็นอัลบั้มนี้ได้" checked={publicField.field.value === "PUBLIC"} onChange={(checked) => publicField.field.onChange(checked ? "PUBLIC" : "RESIDENT")} /><SettingSwitch label="อนุญาตให้ลูกบ้านส่งรูป" helper="เปิดเพื่อให้ลูกบ้านสามารถส่งรูปภาพเข้ามาเพื่อรอการตรวจสอบก่อนเพิ่มลงในอัลบั้ม" checked={submissionsField.field.value === "ALLOW"} onChange={(checked) => submissionsField.field.onChange(checked ? "ALLOW" : "DISALLOW")} /></section>
    {albumId ? <GalleryImageManager value={images} onChange={setImages} onBusyChange={setBusy} disabled={isSubmitting || busy} maxCount={Math.max(10, initialItems.length)} uploadEndpoint={`/api/gallery/images?villageId=${encodeURIComponent(villageId)}`} /> : null}
    <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:items-center"><Button type="button" variant="outline" onClick={() => router.push(`/superadmin/villages/${villageId}/gallery`)} className="w-full sm:w-auto">ยกเลิก</Button><Button type="submit" disabled={busy || isSubmitting} isLoading={isSubmitting} className="w-full sm:w-auto">บันทึก</Button></div>
  </form><ActionReasonDialog open={Boolean(pending)} action="content.archive" title={albumId ? "ยืนยันการแก้ไขอัลบั้ม" : "ยืนยันการสร้างอัลบั้ม"} description="ระบบจะดำเนินการแทนผู้ดูแลหมู่บ้าน บันทึก Audit Log และแจ้งผู้ดูแลหมู่บ้าน" reasonLabel="เหตุผลในการดำเนินการ" helperText="ระบุเหตุผลที่ผู้ดูแลระบบระดับสูงดำเนินการแทนผู้ดูแลหมู่บ้าน" requireReason minReasonLength={5} maxReasonLength={500} loading={busy} onCancel={() => setPending(null)} onSubmit={confirm} /></>;
}

export function SuperAdminItemForm({ villageId, albumId, itemId, defaultValues, hasExistingItems = false }: { villageId: string; albumId: string; itemId?: string; defaultValues?: GalleryImageDraft; hasExistingItems?: boolean }) {
  const router = useRouter(); const toast = useToast(); const [images, setImages] = useState<GalleryImageDraft[]>(defaultValues ? [defaultValues] : []); const [pending, setPending] = useState(false); const [submitting, setSubmitting] = useState(false);
  const submit = async (reason: string) => { setSubmitting(true); const result = itemId ? await updateSuperAdminGalleryItemDataAction(villageId, albumId, itemId, { id: itemId, url: images[0]?.url, fileKey: images[0]?.fileKey, uploadToken: images[0]?.uploadToken, description: images[0]?.description, sortOrder: images[0]?.sortOrder ?? 0, isCover: Boolean(images[0]?.isCover) }, reason) : await addSuperAdminGalleryItemsDataAction(villageId, albumId, images.map((image, index) => ({ url: image.url, fileKey: image.fileKey, uploadToken: image.uploadToken, description: image.description, sortOrder: index, isCover: Boolean(image.isCover) })), reason); setSubmitting(false); if (!result.success) { toast.error(result.error); return; } toast.success(result.message); setPending(false); router.replace(`/superadmin/villages/${villageId}/gallery/${albumId}`); };
  return <><div className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-6"><GalleryImageManager value={images} onChange={setImages} maxCount={itemId ? 1 : 10} autoSelectFirstCover={!hasExistingItems} uploadEndpoint={`/api/gallery/images?villageId=${encodeURIComponent(villageId)}`} disabled={submitting} /><div className="flex flex-col-reverse gap-3 sm:flex-row"><Button type="button" variant="outline" onClick={() => router.push(`/superadmin/villages/${villageId}/gallery/${albumId}`)}>ยกเลิก</Button><Button type="button" disabled={!images.length || submitting} onClick={() => setPending(true)}>บันทึก</Button></div></div><ActionReasonDialog open={pending} action="content.archive" title={itemId ? "ยืนยันการแก้ไขรูปภาพ" : "ยืนยันการเพิ่มรูปภาพ"} description="ระบบจะดำเนินการแทนผู้ดูแลหมู่บ้าน บันทึก Audit Log และแจ้งผู้ดูแลหมู่บ้าน" reasonLabel="เหตุผลในการดำเนินการ" helperText="ระบุเหตุผลที่ผู้ดูแลระบบระดับสูงดำเนินการแทนผู้ดูแลหมู่บ้าน" requireReason minReasonLength={5} maxReasonLength={500} loading={submitting} onCancel={() => setPending(false)} onSubmit={submit} /></>;
}

