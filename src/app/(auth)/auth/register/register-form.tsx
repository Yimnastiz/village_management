"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { ThaiProvince } from "@/lib/thai-geography";

function normalizePhone10(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 10);
}

type VillageOption = {
  id: string;
  name: string;
  slug: string;
  province: string | null;
  district: string | null;
  subdistrict: string | null;
};

type RegisterFormProps = {
  villages: VillageOption[];
  thaiGeography: ThaiProvince[];
  callbackUrl?: string;
};

type RegistrationMode = "resident" | "headman";

export function RegisterForm({ villages, thaiGeography, callbackUrl }: RegisterFormProps) {
  const router = useRouter();
  const [registrationMode, setRegistrationMode] = useState<RegistrationMode>("resident");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [subdistrict, setSubdistrict] = useState("");
  const [villageId, setVillageId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loginHref = callbackUrl
    ? `/auth/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
    : "/auth/login";

  const provinceOptions = useMemo(
    () => thaiGeography.map((provinceItem) => ({ value: provinceItem.name, label: provinceItem.name })),
    [thaiGeography]
  );

  const districtOptions = useMemo(() => {
    const selectedProvince = thaiGeography.find((provinceItem) => provinceItem.name === province);
    if (!selectedProvince) {
      return [] as Array<{ value: string; label: string }>;
    }

    return selectedProvince.districts.map((districtItem) => ({
      value: districtItem.name,
      label: districtItem.name,
    }));
  }, [province, thaiGeography]);

  const subdistrictOptions = useMemo(() => {
    const selectedProvince = thaiGeography.find((provinceItem) => provinceItem.name === province);
    const selectedDistrict = selectedProvince?.districts.find(
      (districtItem) => districtItem.name === district
    );
    if (!selectedDistrict) {
      return [] as Array<{ value: string; label: string }>;
    }

    return selectedDistrict.subdistricts.map((subdistrictName) => ({
      value: subdistrictName,
      label: subdistrictName,
    }));
  }, [district, province, thaiGeography]);

  const villageOptions = useMemo(() => {
    const filtered = villages.filter(
      (village) =>
        village.province === province &&
        village.district === district &&
        village.subdistrict === subdistrict
    );
    return filtered.map((village) => ({
      value: village.id,
      label: `${village.name} (${village.slug})`,
    }));
  }, [district, province, subdistrict, villages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedName = name.trim();
    const normalizedPhone = normalizePhone10(phone);
    const normalizedNationalId = nationalId.replace(/\D/g, "").slice(0, 13);
    if (!normalizedName || !normalizedPhone || !normalizedNationalId || !province || !district || !subdistrict || !villageId) {
      setError("กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน");
      return;
    }

    if (!/^\d{10}$/.test(normalizedPhone)) {
      setError("เบอร์โทรศัพท์ต้องเป็นตัวเลข 10 หลัก");
      return;
    }

    if (!/^\d{13}$/.test(normalizedNationalId)) {
      setError("เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลัก");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await authClient.phoneNumber.sendOtp({
        phoneNumber: normalizedPhone,
      });

      if ((result as { error?: { message?: string } | null })?.error) {
        throw new Error(
          (result as { error?: { message?: string } | null }).error?.message ??
            "ส่ง OTP ไม่สำเร็จ"
        );
      }

      const params = new URLSearchParams({
        mode: "signup",
        registrationMode,
        phone: normalizedPhone,
        nationalId: normalizedNationalId,
        name: normalizedName,
        province,
        district,
        subdistrict,
        villageId,
      });

      if (callbackUrl) {
        params.set("callbackUrl", callbackUrl);
      }

      router.push(`/auth/verify-otp?${params.toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ส่ง OTP ไม่สำเร็จ");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8">
      <h2 className="text-xl font-bold text-gray-900 mb-2">สมัครสมาชิก</h2>
      <p className="text-sm text-gray-500 mb-4">
        ยืนยันเบอร์โทรศัพท์และระบุข้อมูลพื้นที่ของคุณเพื่อเข้าใช้งานระบบหมู่บ้าน
      </p>

      <div className="mb-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setRegistrationMode("resident")}
          className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
            registrationMode === "resident"
              ? "border-green-600 bg-green-50 text-green-700"
              : "border-gray-300 text-gray-700 hover:bg-gray-50"
          }`}
        >
          สมัครลูกบ้านทั่วไป
        </button>
        <button
          type="button"
          onClick={() => setRegistrationMode("headman")}
          className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
            registrationMode === "headman"
              ? "border-blue-600 bg-blue-50 text-blue-700"
              : "border-gray-300 text-gray-700 hover:bg-gray-50"
          }`}
        >
          สมัครผู้ใหญ่บ้าน/กรรมการ
        </button>
      </div>

      {registrationMode === "headman" && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
          โหมดผู้ใหญ่บ้าน: ระบบจะตรวจสอบข้อมูลกับทะเบียนหมู่บ้านและข้อมูลบุคคลกลาง (จังหวัด/อำเภอ/ตำบล/หมู่บ้าน + เลขบัตร + เบอร์โทร)
          หากข้อมูลตรงกันจะเปิดสิทธิ์ผู้ใหญ่บ้านให้อัตโนมัติ โดยไม่ต้องตั้งค่าผ่าน /dev
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={registrationMode === "headman" ? "ชื่อ-นามสกุลผู้สมัคร (ผู้ใหญ่บ้าน/กรรมการ)" : "ชื่อ-นามสกุล"}
          name="name"
          placeholder="เช่น สมชาย ใจดี"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <Input
          label="เบอร์โทรศัพท์"
          name="phone"
          type="tel"
          placeholder="0812345678"
          value={phone}
          onChange={(e) => setPhone(normalizePhone10(e.target.value))}
          inputMode="numeric"
          maxLength={10}
          pattern="[0-9]{10}"
          title="เบอร์โทรศัพท์ต้องเป็นตัวเลข 10 หลัก"
          required
        />

        <Input
          label="เลขบัตรประจำตัวประชาชน"
          name="nationalId"
          type="text"
          placeholder="1234567890123"
          value={nationalId}
          onChange={(e) => setNationalId(e.target.value.replace(/\D/g, "").slice(0, 13))}
          inputMode="numeric"
          maxLength={13}
          pattern="[0-9]{13}"
          title="เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลัก"
          required
        />

        <Select
          label="จังหวัด"
          value={province}
          onChange={(e) => {
            setProvince(e.target.value);
            setDistrict("");
            setSubdistrict("");
            setVillageId("");
          }}
          options={provinceOptions}
          placeholder="เลือกจังหวัด"
          required
        />

        <Select
          label="อำเภอ"
          value={district}
          onChange={(e) => {
            setDistrict(e.target.value);
            setSubdistrict("");
            setVillageId("");
          }}
          options={districtOptions}
          placeholder={province ? "เลือกอำเภอ" : "เลือกจังหวัดก่อน"}
          required
          disabled={!province}
        />

        <Select
          label="ตำบล"
          value={subdistrict}
          onChange={(e) => {
            setSubdistrict(e.target.value);
            setVillageId("");
          }}
          options={subdistrictOptions}
          placeholder={district ? "เลือกตำบล" : "เลือกอำเภอก่อน"}
          required
          disabled={!district}
        />

        <Select
          label={registrationMode === "headman" ? "หมู่บ้านตามทะเบียนกลาง" : "หมู่บ้าน"}
          value={villageId}
          onChange={(e) => setVillageId(e.target.value)}
          options={villageOptions}
          placeholder={subdistrict ? "เลือกหมู่บ้าน" : "เลือกตำบลก่อน"}
          required
          disabled={!subdistrict}
        />

        <div className="flex items-start gap-3">
          <input type="checkbox" required className="mt-1" id="consent" />
          <label htmlFor="consent" className="text-sm text-gray-600">
            ฉันยอมรับ{" "}
            <Link href="/consent" className="text-green-600 hover:underline">
              นโยบายความเป็นส่วนตัว
            </Link>
            
          </label>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" className="w-full" isLoading={isLoading}>
          สมัครสมาชิก
        </Button>
      </form>

      <div className="mt-6 text-center text-sm text-gray-600">
        มีบัญชีอยู่แล้ว?{" "}
        <Link href={loginHref} className="text-green-600 font-medium hover:underline">
          เข้าสู่ระบบ
        </Link>
      </div>
    </div>
  );
}
