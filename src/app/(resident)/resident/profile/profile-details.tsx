"use client";

import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { Edit3, Eye, EyeOff, Info, Save, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { MAX_IMAGE_BYTES } from "@/lib/image-input";
import { revealOwnNationalIdAction, updateProfileAction } from "./actions";
import { revealOwnAdminNationalIdAction, updateAdminProfileAction } from "@/app/(admin)/admin/profile/actions";

type ProfileDetailsProps = {
  user: { id: string; displayName: string; email: string; rawEmail: string; image: string | null; phoneNumber: string; phoneNumberVerified: boolean; emailVerified: boolean; citizenVerified: boolean; accountStatus: string; createdAt: string; updatedAt: string; consentAt: string; citizenVerifiedAt: string };
  person: { firstName: string; lastName: string; hasNationalId: boolean; maskedNationalId: string; dateOfBirth: string; gender: string };
  village: { province: string; district: string; subdistrict: string; currentVillage: string; membershipStatus: string; membershipRole: string; houseNumber: string };
  avatar: { text: string; image: string | null };
  profileArea?: "resident" | "admin";
};

function StatusBadge({ verified, pending = "ยังไม่ยืนยัน" }: { verified: boolean; pending?: string }) {
  return <span className={verified ? "inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800" : "inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800"}>{verified ? "ยืนยันแล้ว" : pending}</span>;
}

function InfoRow({ label, value, children, hint }: { label: string; value?: string; children?: ReactNode; hint?: string }) {
  const empty = !children && (!value || value === "-");
  return <div className="grid min-w-0 grid-cols-[minmax(7.5rem,0.9fr)_minmax(0,1.1fr)] gap-x-3 border-b border-gray-100 py-2.5 last:border-b-0 sm:gap-x-5">
    <dt className="text-sm text-gray-500">{label}</dt>
    <dd className={empty ? "min-w-0 break-words text-sm text-gray-500" : "min-w-0 break-words text-sm font-medium text-gray-900"}>
      {children ?? value ?? "ยังไม่มีข้อมูล"}
      {hint ? <p className="mt-1 text-xs font-normal text-gray-500">{hint}</p> : null}
    </dd>
  </div>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5"><h2 className="mb-1 text-base font-semibold text-gray-900">{title}</h2><dl>{children}</dl></section>;
}

function formatVisibleNationalId(id: string): string {
  const digits = id.replace(/\D/g, "");
  return digits.length === 13 ? `${digits[0]}-${digits.slice(1, 5)}-${digits.slice(5, 10)}-${digits.slice(10, 12)}-${digits[12]}` : id;
}

function NationalIdValue({ maskedNationalId, profileArea = "resident" }: { maskedNationalId: string; profileArea?: "resident" | "admin" }) {
  const [nationalId, setNationalId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const toggleVisibility = async () => {
    if (nationalId) {
      setNationalId(null);
      return;
    }

    setIsLoading(true);
    try {
      const result = profileArea === "admin" ? await revealOwnAdminNationalIdAction() : await revealOwnNationalIdAction();
      if (result.success) setNationalId(result.nationalId);
    } finally {
      setIsLoading(false);
    }
  };

  const isVisible = Boolean(nationalId);
  return <div className="flex min-w-0 items-center gap-1">
    <span className="min-w-0 break-all">{nationalId ? formatVisibleNationalId(nationalId) : maskedNationalId}</span>
    <button type="button" onClick={toggleVisibility} disabled={isLoading} aria-label={isVisible ? "ซ่อนเลขบัตรประชาชน" : "แสดงเลขบัตรประชาชน"} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:cursor-wait disabled:opacity-60">
      {isVisible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
    </button>
  </div>;
}

export function ProfileDetails({ user, person, village, avatar, profileArea = "resident" }: ProfileDetailsProps) {
  const router = useRouter();
  const { success: showSuccess, error: showError } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber === "ยังไม่มีข้อมูล" ? "" : user.phoneNumber);
  const [email, setEmail] = useState(user.rawEmail);
  const [image, setImage] = useState<string | null>(user.image);
  const [isPending, setIsPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const cancelEdit = () => { setPhoneNumber(user.phoneNumber === "ยังไม่มีข้อมูล" ? "" : user.phoneNumber); setEmail(user.rawEmail); setImage(user.image); setFormError(null); setIsEditing(false); };
  const selectImage = (file?: File) => {
    if (!file) return;
    if (!file.type.match(/^image\/(jpeg|png|webp)$/) || file.size > MAX_IMAGE_BYTES) { setFormError("รองรับไฟล์ JPG, PNG หรือ WebP ขนาดไม่เกิน 5 MB"); return; }
    const reader = new FileReader();
    reader.onload = () => setImage(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  };
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setIsPending(true); setFormError(null);
    try {
      const result = profileArea === "admin" ? await updateAdminProfileAction({ phoneNumber, email, image }) : await updateProfileAction({ phoneNumber, email, image });
      if (!result.success) { setFormError(result.error); showError("บันทึกโปรไฟล์ไม่สำเร็จ"); return; }
      showSuccess("บันทึกโปรไฟล์สำเร็จ"); setIsEditing(false); router.refresh();
    } catch { setFormError("ไม่สามารถบันทึกข้อมูลโปรไฟล์ได้ กรุณาลองใหม่อีกครั้ง"); showError("บันทึกโปรไฟล์ไม่สำเร็จ"); }
    finally { setIsPending(false); }
  };
  return <div className="space-y-4">
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {avatar.image ? <img src={avatar.image} alt="รูปโปรไฟล์" className="h-16 w-16 flex-none rounded-full border border-gray-200 object-cover" /> : <div className={`flex h-16 w-16 flex-none items-center justify-center rounded-full text-xl font-bold ${profileArea === "admin" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>{avatar.text}</div>}
          <div className="min-w-0"><p className="text-xs font-medium text-gray-500">ข้อมูลผู้ใช้งาน</p><h2 className="truncate text-lg font-semibold text-gray-900">{user.displayName}</h2><p className="mt-1 text-sm text-gray-500">{user.phoneNumber}</p><div className="mt-2"><StatusBadge verified={user.accountStatus === "ACTIVE"} pending="ไม่พร้อมใช้งาน" /></div></div>
        </div>
        {!isEditing ? <Button type="button" variant="outline" className="min-h-10 w-full shrink-0 gap-2 sm:w-auto" onClick={() => setIsEditing(true)}><Edit3 className="h-4 w-4" />แก้ไขข้อมูล</Button> : null}
      </div>
      {isEditing && <form onSubmit={submit} className="mt-5 border-t border-gray-100 pt-5">
        <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
          <button type="button" onClick={() => fileInputRef.current?.click()} className="group relative mx-auto h-20 w-20 overflow-hidden rounded-full border border-dashed border-gray-300 bg-gray-50 sm:mx-0" aria-label="เลือกรูปโปรไฟล์">
            {image ? <img src={image} alt="ตัวอย่างรูปโปรไฟล์" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center bg-green-100 text-2xl font-bold text-green-700">{avatar.text}</span>}
            <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100"><Upload className="h-5 w-5" /></span>
          </button>
          <div><div className="flex flex-wrap items-center gap-2"><Button type="button" variant="outline" className="min-h-10" onClick={() => fileInputRef.current?.click()}><Upload className="mr-2 h-4 w-4" />เปลี่ยนรูป</Button>{image && <button type="button" className="text-sm text-red-600 hover:underline" onClick={() => setImage(null)}>ลบรูป</button>}</div><p className="mt-1 text-xs text-gray-500">JPG, PNG หรือ WebP ขนาดไม่เกิน 5 MB</p><input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => selectImage(event.target.files?.[0])} /></div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2"><Input label="เบอร์โทรศัพท์" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value.replace(/\D/g, "").slice(0, 10))} required inputMode="numeric" maxLength={10} helperText="เปลี่ยนเบอร์แล้วจะต้องยืนยันใหม่" /><Input label="อีเมล" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="example@email.com" helperText="เปลี่ยนอีเมลแล้วจะต้องยืนยันใหม่" /></div>
        {formError && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" disabled={isPending} className="min-h-10" onClick={cancelEdit}><X className="mr-2 h-4 w-4" />ยกเลิก</Button><Button type="submit" isLoading={isPending} className="min-h-10"><Save className="mr-2 h-4 w-4" />บันทึก</Button></div>
      </form>}
    </section>
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Section title="ข้อมูลพื้นฐาน"><InfoRow label="ชื่อจริง" value={person.firstName} /><InfoRow label="นามสกุลจริง" value={person.lastName} /><InfoRow label="วันเกิด" value={person.dateOfBirth} /><InfoRow label="เพศ" value={person.gender} /><InfoRow label="เลขบัตรประชาชน">{person.hasNationalId ? <NationalIdValue maskedNationalId={person.maskedNationalId} profileArea={profileArea} /> : "ยังไม่มีข้อมูล"}</InfoRow><InfoRow label="เบอร์โทร" value={user.phoneNumber} /><InfoRow label="อีเมล" value={user.email} /><InfoRow label="ยืนยันเบอร์โทร"><StatusBadge verified={user.phoneNumberVerified} /></InfoRow><InfoRow label="ยืนยันอีเมล"><StatusBadge verified={user.emailVerified} /></InfoRow><InfoRow label="ยืนยันตัวตนพลเมือง"><StatusBadge verified={user.citizenVerified} pending="รอตรวจสอบ" /></InfoRow></Section>
      <Section title="ข้อมูลหมู่บ้านและที่อยู่"><InfoRow label="จังหวัด" value={village.province} /><InfoRow label="อำเภอ" value={village.district} /><InfoRow label="ตำบล" value={village.subdistrict} /><InfoRow label="หมู่บ้าน" value={village.currentVillage} /><InfoRow label="สถานะการผูกบ้าน" value={village.membershipStatus} /><InfoRow label="บทบาทในหมู่บ้าน" value={village.membershipRole} /><InfoRow label="บ้านเลขที่" value={village.houseNumber} /><div className="mt-3 flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /><p>หากข้อมูลทะเบียนประชากรหรือครัวเรือนไม่ถูกต้อง กรุณาติดต่อผู้ใหญ่บ้านหรือผู้ช่วยผู้ใหญ่บ้าน</p></div></Section>
    </div>
    <Section title="ข้อมูลการใช้งานบัญชี"><InfoRow label="สมัครเมื่อ" value={user.createdAt} /><InfoRow label="อัปเดตล่าสุด" value={user.updatedAt} /><InfoRow label="ยินยอมข้อมูลส่วนบุคคล" value={user.consentAt} /><InfoRow label="ยืนยันตัวตนเมื่อ" value={user.citizenVerifiedAt} /></Section>
  </div>;
}
