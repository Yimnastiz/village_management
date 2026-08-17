"use client";

/* Profile images can be data URLs selected locally, which next/image does not support. */
/* eslint-disable @next/next/no-img-element */

import { useRef, useState } from "react";
import { Edit3, Save, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { MAX_IMAGE_BYTES } from "@/lib/image-input";
import { updatePersonalSettingsAction } from "../actions";

type Profile = { name: string; firstName: string | null; lastName: string | null; phone: string; email: string | null; image: string | null; role: string; houseNumber: string | null };
const shown = (value: string | null | undefined) => value?.trim() || "-";
function Row({ label, value }: { label: string; value: string | null | undefined }) { return <div className="grid gap-1 border-b border-gray-100 py-3 last:border-0 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4"><dt className="text-sm text-gray-500">{label}</dt><dd className="min-w-0 break-words text-sm font-medium text-gray-900">{shown(value)}</dd></div>; }

export function PersonalSettings({ profile }: { profile: Profile }) {
  const router = useRouter(); const toast = useToast(); const fileRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false); const [pending, setPending] = useState(false); const [email, setEmail] = useState(profile.email ?? ""); const [image, setImage] = useState(profile.image); const [formError, setFormError] = useState<string | null>(null);
  const displayName = [profile.firstName, profile.lastName].filter(Boolean).join(" ") || profile.name;
  const cancel = () => { setEmail(profile.email ?? ""); setImage(profile.image); setFormError(null); setEditing(false); };
  const chooseImage = (file?: File) => { if (!file) return; if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > MAX_IMAGE_BYTES) { setFormError("รองรับไฟล์ JPG, PNG หรือ WebP ขนาดไม่เกิน 5 MB"); return; } const reader = new FileReader(); reader.onload = () => setImage(typeof reader.result === "string" ? reader.result : null); reader.readAsDataURL(file); };
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setPending(true); setFormError(null); try { const result = await updatePersonalSettingsAction({ email, image }); if (!result.success) { setFormError(result.error); toast.error("บันทึกข้อมูลส่วนตัวไม่สำเร็จ", result.error); return; } toast.success("บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว"); setEditing(false); router.refresh(); } catch { setFormError("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"); toast.error("บันทึกข้อมูลส่วนตัวไม่สำเร็จ"); } finally { setPending(false); } }
  return <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
    <header className="flex items-start justify-between gap-3"><div><h2 className="text-base font-semibold text-gray-900">ข้อมูลส่วนตัว</h2><p className="mt-1 text-sm text-gray-500">ข้อมูลบัญชีและข้อมูลที่ใช้แสดงตัวตนของคุณ</p></div>{!editing ? <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}><Edit3 className="mr-2 h-4 w-4" />แก้ไข</Button> : null}</header>
    {!editing ? <div className="mt-5"><div className="mb-4 flex items-center gap-3">{profile.image ? <img src={profile.image} alt="รูปโปรไฟล์" className="h-16 w-16 rounded-full border border-gray-200 object-cover" /> : <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-xl font-semibold text-gray-700">{displayName[0] ?? "?"}</div>}<div><p className="font-semibold text-gray-900">{displayName}</p><p className="text-sm text-gray-500">{profile.role}</p></div></div><dl><Row label="ชื่อ-นามสกุล" value={displayName} /><Row label="ตำแหน่ง" value={profile.role} /><Row label="เบอร์โทรศัพท์" value={profile.phone} /><Row label="อีเมล" value={profile.email} /><Row label="บ้านเลขที่" value={profile.houseNumber} /></dl></div> :
      <form onSubmit={submit} className="mt-5 space-y-5 border-t border-gray-100 pt-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center"><button type="button" onClick={() => fileRef.current?.click()} className="h-20 w-20 overflow-hidden rounded-full border border-dashed border-gray-300 bg-gray-50" aria-label="เลือกรูปโปรไฟล์">{image ? <img src={image} alt="ตัวอย่างรูปโปรไฟล์" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-xl font-semibold">{displayName[0] ?? "?"}</span>}</button><div className="flex flex-wrap items-center gap-2"><Button type="button" variant="outline" onClick={() => fileRef.current?.click()}><Upload className="mr-2 h-4 w-4" />เปลี่ยนรูป</Button>{image ? <button type="button" className="text-sm text-red-600 hover:underline" onClick={() => setImage(null)}>ลบรูป</button> : null}<input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => chooseImage(event.target.files?.[0])} /></div></div>
        <div className="grid gap-4 sm:grid-cols-2"><Input label="อีเมล" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="example@email.com" helperText="เมื่อเปลี่ยนอีเมล สถานะการยืนยันอีเมลจะถูกรีเซ็ต" /><div><p className="mb-1 text-sm font-medium text-gray-700">เบอร์โทรศัพท์</p><p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800">{profile.phone}</p><p className="mt-1 text-xs text-gray-500">เป็นข้อมูลเข้าสู่ระบบ จึงเปลี่ยนไม่ได้จนกว่าจะยืนยันด้วย OTP ผ่านขั้นตอนเปลี่ยนเบอร์</p></div></div>
        {formError ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p> : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" disabled={pending} onClick={cancel}><X className="mr-2 h-4 w-4" />ยกเลิก</Button><Button type="submit" isLoading={pending}><Save className="mr-2 h-4 w-4" />บันทึกการแก้ไข</Button></div>
      </form>}
  </section>;
}
