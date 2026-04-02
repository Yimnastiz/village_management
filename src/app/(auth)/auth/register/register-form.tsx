"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [registrationMode, setRegistrationMode] = useState<RegistrationMode>("resident");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
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

  useEffect(() => {
    if (!isPrivacyModalOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsPrivacyModalOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPrivacyModalOpen]);

  const provinceOptions = useMemo(() => thaiGeography.map((provinceItem) => provinceItem.name), [thaiGeography]);

  const districtOptions = useMemo(() => {
    const selectedProvince = thaiGeography.find((provinceItem) => provinceItem.name === province);
    if (!selectedProvince) {
      return [] as string[];
    }

    return selectedProvince.districts.map((districtItem) => districtItem.name);
  }, [province, thaiGeography]);

  const subdistrictOptions = useMemo(() => {
    const selectedProvince = thaiGeography.find((provinceItem) => provinceItem.name === province);
    const selectedDistrict = selectedProvince?.districts.find(
      (districtItem) => districtItem.name === district
    );
    if (!selectedDistrict) {
      return [] as string[];
    }

    return selectedDistrict.subdistricts;
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

    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();
    const normalizedName = `${normalizedFirstName} ${normalizedLastName}`.trim();
    const normalizedPhone = normalizePhone10(phone);
    const normalizedNationalId = nationalId.replace(/\D/g, "").slice(0, 13);
    if (!normalizedFirstName || !normalizedLastName || !normalizedPhone || !normalizedNationalId || !province || !district || !subdistrict || !villageId) {
      setError("กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน");
      return;
    }

    if (!provinceOptions.includes(province)) {
      setError("กรุณาเลือกจังหวัดจากรายการ");
      return;
    }

    if (!districtOptions.includes(district)) {
      setError("กรุณาเลือกอำเภอจากรายการ");
      return;
    }

    if (!subdistrictOptions.includes(subdistrict)) {
      setError("กรุณาเลือกตำบลจากรายการ");
      return;
    }

    if (!villageOptions.some((village) => village.value === villageId)) {
      setError("กรุณาเลือกหมู่บ้านจากรายการ");
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
      <div className="mb-3">
        <Link href="/landing" className="text-sm font-medium text-green-700 hover:underline">
          กลับไปหน้าเว็บไซต์หมู่บ้าน
        </Link>
      </div>
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="ชื่อ"
            name="firstName"
            placeholder="เช่น สมชาย"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
          <Input
            label="นามสกุล"
            name="lastName"
            placeholder="เช่น ใจดี"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </div>

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

        <Input
          label="จังหวัด"
          name="province"
          list="register-province-options"
          autoComplete="off"
          value={province}
          onChange={(e) => {
            setProvince(e.target.value);
            setDistrict("");
            setSubdistrict("");
            setVillageId("");
            setError(null);
          }}
          placeholder="พิมพ์หรือเลือกจังหวัด"
          helperText="พิมพ์ค้นหาได้ หรือเลือกจากรายการด้านล่าง"
          required
        />
        <datalist id="register-province-options">
          {provinceOptions.map((provinceName) => (
            <option key={provinceName} value={provinceName} />
          ))}
        </datalist>

        <Input
          label="อำเภอ"
          name="district"
          list="register-district-options"
          autoComplete="off"
          value={district}
          onChange={(e) => {
            setDistrict(e.target.value);
            setSubdistrict("");
            setVillageId("");
            setError(null);
          }}
          placeholder={province ? "พิมพ์หรือเลือกอำเภอ" : "เลือกจังหวัดก่อน"}
          helperText={province ? "พิมพ์ค้นหาได้ หรือเลือกจากรายการด้านล่าง" : undefined}
          required
          disabled={!province}
        />
        <datalist id="register-district-options">
          {districtOptions.map((districtName) => (
            <option key={districtName} value={districtName} />
          ))}
        </datalist>

        <Input
          label="ตำบล"
          name="subdistrict"
          list="register-subdistrict-options"
          autoComplete="off"
          value={subdistrict}
          onChange={(e) => {
            setSubdistrict(e.target.value);
            setVillageId("");
            setError(null);
          }}
          placeholder={district ? "พิมพ์หรือเลือกตำบล" : "เลือกอำเภอก่อน"}
          helperText={district ? "พิมพ์ค้นหาได้ หรือเลือกจากรายการด้านล่าง" : undefined}
          required
          disabled={!district}
        />
        <datalist id="register-subdistrict-options">
          {subdistrictOptions.map((subdistrictName) => (
            <option key={subdistrictName} value={subdistrictName} />
          ))}
        </datalist>

        <div className="w-full">
          <label htmlFor="register-village" className="mb-1 block text-sm font-medium text-gray-700">
            {registrationMode === "headman" ? "หมู่บ้านตามทะเบียนกลาง" : "หมู่บ้าน"}
          </label>
          <select
            id="register-village"
            name="villageId"
            className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-50 disabled:text-gray-400"
            value={villageId}
            onChange={(e) => setVillageId(e.target.value)}
            required
            disabled={!subdistrict}
          >
            <option value="">{subdistrict ? "เลือกหมู่บ้าน" : "เลือกตำบลก่อน"}</option>
            {villageOptions.map((village) => (
              <option key={village.value} value={village.value}>
                {village.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">เลือกหมู่บ้านจากรายการหลังจากระบุตำบลแล้ว</p>
        </div>

        <div className="flex items-start gap-3">
          <input type="checkbox" required className="mt-1" id="consent" />
          <label htmlFor="consent" className="text-sm text-gray-600">
            ฉันยอมรับ{" "}
            <button
              type="button"
              className="text-green-600 hover:underline"
              onClick={() => setIsPrivacyModalOpen(true)}
            >
              นโยบายความเป็นส่วนตัว
            </button>
            
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

      {isPrivacyModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setIsPrivacyModalOpen(false)}
        >
          <div
            className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-gray-200 bg-white p-5 shadow-2xl sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-gray-900">นโยบายความเป็นส่วนตัว</h3>
              <button
                type="button"
                onClick={() => setIsPrivacyModalOpen(false)}
                className="rounded-lg border border-gray-200 px-3 py-1 text-sm text-gray-600 hover:bg-gray-50"
              >
                ปิด
              </button>
            </div>

            <p className="text-xs text-gray-500">อัปเดตล่าสุด: มกราคม 2566</p>
            <div className="mt-3 space-y-3 text-sm text-gray-700">
              <div>
                <p className="font-semibold text-gray-900">1. ข้อมูลที่เราเก็บรวบรวม</p>
                <p>ระบบเก็บรวบรวมข้อมูลส่วนบุคคล ได้แก่ ชื่อ-นามสกุล เบอร์โทรศัพท์ ที่อยู่ และข้อมูลครัวเรือน</p>
              </div>
              <div>
                <p className="font-semibold text-gray-900">2. วัตถุประสงค์การใช้ข้อมูล</p>
                <p>ใช้เพื่อการบริหารจัดการหมู่บ้าน การให้บริการแก่สมาชิก และการสื่อสารภายในชุมชน</p>
              </div>
              <div>
                <p className="font-semibold text-gray-900">3. การรักษาความปลอดภัย</p>
                <p>ข้อมูลอ่อนไหวจะถูกเข้ารหัสและแสดงเป็น masked เช่น เลขบัตรประชาชน</p>
              </div>
              <div>
                <p className="font-semibold text-gray-900">4. สิทธิของเจ้าของข้อมูล</p>
                <p>คุณมีสิทธิ์เข้าถึง แก้ไข และขอลบข้อมูลของคุณได้ผ่านระบบหรือติดต่อผู้ดูแลหมู่บ้าน</p>
              </div>
              <div>
                <p className="font-semibold text-gray-900">5. การติดต่อ</p>
                <p>หากมีคำถามเกี่ยวกับนโยบายความเป็นส่วนตัว กรุณาติดต่อ privacy@village.go.th</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
