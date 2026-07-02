"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ThaiProvince } from "@/lib/thai-geography";

function normalizePhone10(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 10);
}

const REGISTRATION_DRAFT_KEY = "village_auth_registration_draft";

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

type RegistrationDraft = {
  registrationMode: RegistrationMode;
  firstName: string;
  lastName: string;
  phone: string;
  nationalId: string;
  province: string;
  district: string;
  subdistrict: string;
  villageId: string;
  callbackUrl?: string;
  savedAt: number;
};

function loadRegistrationDraft(): RegistrationDraft | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(REGISTRATION_DRAFT_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as RegistrationDraft;
    if (!parsed?.savedAt || typeof parsed.savedAt !== "number") {
      return null;
    }

    if (Date.now() - parsed.savedAt > 24 * 60 * 60 * 1000) {
      window.localStorage.removeItem(REGISTRATION_DRAFT_KEY);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function saveRegistrationDraft(draft: Omit<RegistrationDraft, "savedAt">) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    REGISTRATION_DRAFT_KEY,
    JSON.stringify({ ...draft, savedAt: Date.now() })
  );
}

function clearRegistrationDraft() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(REGISTRATION_DRAFT_KEY);
}

export function RegisterForm({ villages, thaiGeography, callbackUrl }: RegisterFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [draftLoaded, setDraftLoaded] = useState(false);
  const loginHref = callbackUrl
    ? `/auth/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
    : "/auth/login";

  // Populate form from URL params (when coming back from verify-otp)
  useEffect(() => {
    const modeParam = searchParams.get("mode");
    const firstNameParam = searchParams.get("firstName");
    const lastNameParam = searchParams.get("lastName");
    const phoneParam = searchParams.get("phone");
    const nationalIdParam = searchParams.get("nationalId");
    const provinceParam = searchParams.get("province");
    const districtParam = searchParams.get("district");
    const subdistrictParam = searchParams.get("subdistrict");
    const villageIdParam = searchParams.get("villageId");

    if (modeParam === "headman") {
      setRegistrationMode("headman");
    }

    if (firstNameParam) setFirstName(firstNameParam);
    if (lastNameParam) setLastName(lastNameParam);
    if (phoneParam) setPhone(phoneParam);
    if (nationalIdParam) setNationalId(nationalIdParam);
    if (provinceParam) setProvince(provinceParam);
    if (districtParam) setDistrict(districtParam);
    if (subdistrictParam) setSubdistrict(subdistrictParam);
    if (villageIdParam) setVillageId(villageIdParam);

    if (!draftLoaded && !phoneParam && !firstNameParam && !lastNameParam) {
      const storedDraft = loadRegistrationDraft();
      if (storedDraft) {
        setRegistrationMode(storedDraft.registrationMode);
        setFirstName(storedDraft.firstName);
        setLastName(storedDraft.lastName);
        setPhone(storedDraft.phone);
        setNationalId(storedDraft.nationalId);
        setProvince(storedDraft.province);
        setDistrict(storedDraft.district);
        setSubdistrict(storedDraft.subdistrict);
        setVillageId(storedDraft.villageId);
      }
      setDraftLoaded(true);
    }
  }, [searchParams, draftLoaded]);

  useEffect(() => {
    if (!draftLoaded) {
      return;
    }

    saveRegistrationDraft({
      registrationMode,
      firstName,
      lastName,
      phone,
      nationalId,
      province,
      district,
      subdistrict,
      villageId,
      callbackUrl,
    });
  }, [callbackUrl, draftLoaded, district, firstName, lastName, nationalId, phone, province, registrationMode, subdistrict, villageId]);

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

    // Validate headman data before sending OTP
    if (registrationMode === "headman") {
      setIsLoading(true);
      setError(null);

      try {
        const validateResponse = await fetch("/api/auth/validate-headman", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            phoneNumber: normalizedPhone,
            nationalId: normalizedNationalId,
            province,
            district,
            subdistrict,
            villageId,
          }),
        });

        if (!validateResponse.ok) {
          const errorData = await validateResponse.json().catch(() => ({ error: "การตรวจสอบข้อมูลล้มเหลว" }));
          setError(errorData.error || "ข้อมูลไม่ถูกต้องสำหรับผู้ใหญ่บ้าน");
          setIsLoading(false);
          return;
        }
      } catch (err) {
        setError("ไม่สามารถตรวจสอบข้อมูลได้ กรุณาลองใหม่");
        setIsLoading(false);
        return;
      }
    }

    setIsLoading(true);
    setError(null);

    saveRegistrationDraft({
      mode: "signup",
      registrationMode,
      firstName: normalizedFirstName,
      lastName: normalizedLastName,
      phone: normalizedPhone,
      nationalId: normalizedNationalId,
      province,
      district,
      subdistrict,
      villageId,
      callbackUrl,
    });

    try {
      const checkResponse = await fetch("/api/auth/check-phone", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phoneNumber: normalizedPhone }),
      });

      if (!checkResponse.ok) {
        const checkError = (await checkResponse.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(
          checkError?.error ?? "ไม่สามารถตรวจสอบเบอร์โทรศัพท์ได้ กรุณาลองใหม่"
        );
      }

      const startResponse = await fetch("/api/auth/start-registration", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phoneNumber: normalizedPhone,
          registrationMode,
          name: normalizedName,
          nationalId: normalizedNationalId,
          province,
          district,
          subdistrict,
          villageId,
          callbackUrl,
        }),
      });

      if (!startResponse.ok) {
        const startError = (await startResponse.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(
          startError?.error ?? "ไม่สามารถเริ่มการสมัครสมาชิกได้ กรุณาลองใหม่"
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

        <div className="space-y-1">
          <label htmlFor="province" className="text-sm font-medium text-gray-700">
            จังหวัด
          </label>
          <select
            id="province"
            name="province"
            value={province}
            onChange={(e) => {
              setProvince(e.target.value);
              setDistrict("");
              setSubdistrict("");
              setVillageId("");
              setError(null);
            }}
            required
            className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">เลือกจังหวัด</option>
            {provinceOptions.map((provinceName) => (
              <option key={provinceName} value={provinceName}>
                {provinceName}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500">เลือกจังหวัดจากรายการ</p>
        </div>

        <div className="space-y-1">
          <label htmlFor="district" className="text-sm font-medium text-gray-700">
            อำเภอ
          </label>
          <select
            id="district"
            name="district"
            value={district}
            onChange={(e) => {
              setDistrict(e.target.value);
              setSubdistrict("");
              setVillageId("");
              setError(null);
            }}
            required
            disabled={!province}
            className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-50 disabled:text-gray-400"
          >
            <option value="">{province ? "เลือกอำเภอ" : "เลือกจังหวัดก่อน"}</option>
            {districtOptions.map((districtName) => (
              <option key={districtName} value={districtName}>
                {districtName}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500">
            {province ? "เลือกอำเภอจากรายการ" : "เลือกจังหวัดก่อนเพื่อเปิดอำเภอ"}
          </p>
        </div>

        <div className="space-y-1">
          <label htmlFor="subdistrict" className="text-sm font-medium text-gray-700">
            ตำบล
          </label>
          <select
            id="subdistrict"
            name="subdistrict"
            value={subdistrict}
            onChange={(e) => {
              setSubdistrict(e.target.value);
              setVillageId("");
              setError(null);
            }}
            required
            disabled={!district}
            className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-50 disabled:text-gray-400"
          >
            <option value="">{district ? "เลือกตำบล" : "เลือกอำเภอก่อน"}</option>
            {subdistrictOptions.map((subdistrictName) => (
              <option key={subdistrictName} value={subdistrictName}>
                {subdistrictName}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500">
            {district ? "เลือกตำบลจากรายการ" : "เลือกอำเภอก่อนเพื่อเปิดตำบล"}
          </p>
        </div>

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
