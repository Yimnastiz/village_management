"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Edit3, Eye, EyeOff, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { updateProfileAction } from "./actions";

type ProfileDetailsProps = {
  user: {
    id: string;
    displayName: string;
    email: string;
    rawEmail: string;
    image: string | null;
    phoneNumber: string;
    phoneNumberVerified: boolean;
    emailVerified: boolean;
    citizenVerified: boolean;
    createdAt: string;
    updatedAt: string;
    consentAt: string;
    citizenVerifiedAt: string;
  };
  person: {
    firstName: string;
    lastName: string;
    nationalId: string | null;
    maskedNationalId: string;
  };
  village: {
    province: string;
    district: string;
    subdistrict: string;
    registrationVillage: string;
    activeVillage: string;
    membershipStatus: string;
    membershipRole: string;
    houseNumber: string;
  };
  avatar: {
    text: string;
    image: string | null;
  };
};

function fullNationalId(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 13) return value;
  return `${digits[0]}-${digits.slice(1, 5)}-${digits.slice(5, 10)}-${digits.slice(10, 12)}-${digits[12]}`;
}

function VerifyValue({ verified, pendingText = "ยังไม่ยืนยัน" }: { verified: boolean; pendingText?: string }) {
  return (
    <span className={verified ? "font-medium text-green-700" : "font-medium text-amber-700"}>
      {verified ? "ยืนยันแล้ว" : pendingText}
    </span>
  );
}

function InfoItem({
  label,
  value,
  children,
  hint,
}: {
  label: string;
  value?: string;
  children?: ReactNode;
  hint?: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-gray-100 bg-gray-50/70 px-3 py-2">
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="mt-1 min-w-0 break-words text-sm font-medium text-gray-900">
        {children ?? value ?? "-"}
      </dd>
      {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="mb-3 text-base font-semibold text-gray-900">{title}</h2>
      <dl className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">{children}</dl>
    </section>
  );
}

export function ProfileDetails({
  user,
  person,
  village,
  avatar,
}: ProfileDetailsProps) {
  const router = useRouter();
  const { success: showSuccess, error: showError } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user.displayName === "-" ? "" : user.displayName);
  const [isPending, setIsPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showNationalId, setShowNationalId] = useState(false);
  const hasNationalId = Boolean(person.nationalId);

  const cancelEdit = () => {
    setDisplayName(user.displayName === "-" ? "" : user.displayName);
    setFormError(null);
    setIsEditing(false);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsPending(true);
    setFormError(null);

    try {
      const result = await updateProfileAction({
        name: displayName,
        email: user.rawEmail,
        image: user.image,
      });

      if (!result.success) {
        setFormError(result.error);
        showError("บันทึกโปรไฟล์ไม่สำเร็จ", "กรุณาตรวจสอบข้อมูลแล้วลองใหม่อีกครั้ง");
        return;
      }

      showSuccess("บันทึกโปรไฟล์สำเร็จ");
      setIsEditing(false);
      router.refresh();
    } catch (cause) {
      console.error("Unable to update profile", cause);
      setFormError("ไม่สามารถบันทึกข้อมูลโปรไฟล์ได้ กรุณาลองใหม่อีกครั้ง");
      showError("บันทึกโปรไฟล์ไม่สำเร็จ", "กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsPending(false);
    }
  };

  const nationalIdLabel = showNationalId ? "ซ่อนเลขบัตรประชาชน" : "แสดงเลขบัตรประชาชน";
  const nationalIdValue =
    showNationalId && person.nationalId
      ? fullNationalId(person.nationalId)
      : person.maskedNationalId;

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            {avatar.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatar.image}
                alt="Profile"
                className="h-14 w-14 flex-none rounded-full border border-gray-200 object-cover sm:h-16 sm:w-16"
              />
            ) : (
              <div className="flex h-14 w-14 flex-none items-center justify-center rounded-full bg-green-100 text-xl font-bold text-green-700 sm:h-16 sm:w-16">
                {avatar.text}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-500">ชื่อที่แสดงในเว็บ</p>
              <h2 className="truncate text-lg font-semibold text-gray-900">{user.displayName}</h2>
              <p className="mt-1 text-sm text-gray-500">{user.phoneNumber}</p>
            </div>
          </div>

          {!isEditing ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-10 w-full gap-2 sm:w-auto"
              onClick={() => setIsEditing(true)}
            >
              <Edit3 className="h-4 w-4" />
              แก้ไขโปรไฟล์
            </Button>
          ) : null}
        </div>

        {isEditing ? (
          <form onSubmit={handleSubmit} className="mt-4 rounded-lg border border-green-100 bg-green-50/40 p-3 sm:p-4">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
              <Input
                label="ชื่อที่แสดงในเว็บ"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                required
                minLength={2}
                maxLength={120}
                helperText="ข้อมูลนี้ใช้แสดงในเมนูและกิจกรรมบนเว็บ ไม่เปลี่ยนชื่อจริงที่ลงทะเบียน"
                className="min-h-10"
              />
              <div className="flex gap-2">
                <Button type="submit" isLoading={isPending} className="min-h-10 flex-1 gap-2 lg:flex-none">
                  <Save className="h-4 w-4" />
                  บันทึก
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending}
                  className="min-h-10 flex-1 gap-2 lg:flex-none"
                  onClick={cancelEdit}
                >
                  <X className="h-4 w-4" />
                  ยกเลิก
                </Button>
              </div>
            </div>
            {formError ? (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {formError}
              </p>
            ) : null}
          </form>
        ) : null}
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Section title="ข้อมูลพื้นฐาน">
          <InfoItem label="ชื่อจริง" value={person.firstName} hint="ข้อมูลลงทะเบียน แก้ไขไม่ได้" />
          <InfoItem label="นามสกุลจริง" value={person.lastName} hint="ข้อมูลลงทะเบียน แก้ไขไม่ได้" />
          <InfoItem label="ชื่อที่แสดงในเว็บ" value={user.displayName} />
          <InfoItem label="อีเมล" value={user.email} />
          <InfoItem label="รหัสผู้ใช้" value={user.id} />
          <InfoItem label="เบอร์โทร" value={user.phoneNumber} />
          <InfoItem label="ยืนยันเบอร์โทร">
            <VerifyValue verified={user.phoneNumberVerified} />
          </InfoItem>
          <InfoItem label="ยืนยันอีเมล">
            <VerifyValue verified={user.emailVerified} />
          </InfoItem>
          <InfoItem label="ยืนยันตัวตนพลเมือง">
            <VerifyValue verified={user.citizenVerified} pendingText="รอตรวจสอบ" />
          </InfoItem>
        </Section>

        <Section title="ข้อมูลหมู่บ้านและที่อยู่">
          <InfoItem label="จังหวัด" value={village.province} />
          <InfoItem label="อำเภอ" value={village.district} />
          <InfoItem label="ตำบล" value={village.subdistrict} />
          <InfoItem label="หมู่บ้านที่ลงทะเบียน" value={village.registrationVillage} />
          <InfoItem label="หมู่บ้านที่สังกัดปัจจุบัน" value={village.activeVillage} />
          <InfoItem label="สถานะสมาชิก" value={village.membershipStatus} />
          <InfoItem label="บทบาทสมาชิก" value={village.membershipRole} />
          <InfoItem label="บ้านเลขที่" value={village.houseNumber} />
          <InfoItem label="เลขบัตรประชาชน">
            <span className="inline-flex max-w-full items-center gap-2">
              <span className="break-all">{hasNationalId ? nationalIdValue : "-"}</span>
              {hasNationalId ? (
                <button
                  type="button"
                  aria-label={nationalIdLabel}
                  title={nationalIdLabel}
                  className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                  onClick={() => setShowNationalId((value) => !value)}
                >
                  {showNationalId ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              ) : null}
            </span>
          </InfoItem>
        </Section>
      </div>

      <Section title="ข้อมูลการใช้งานบัญชี">
        <InfoItem label="สมัครเมื่อ" value={user.createdAt} />
        <InfoItem label="อัปเดตล่าสุด" value={user.updatedAt} />
        <InfoItem label="ยินยอมข้อมูลส่วนบุคคล" value={user.consentAt} />
        <InfoItem label="ยืนยันตัวตนเมื่อ" value={user.citizenVerifiedAt} />
      </Section>
    </div>
  );
}
