"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SuggestCombobox } from "@/components/ui/suggest-combobox";
import { useToast } from "@/components/ui/toast";
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

type RegistrationMode = "resident";

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

export function RegisterForm({ villages, thaiGeography, callbackUrl }: RegisterFormProps) {
  const router = useRouter();
  const { success, error: showError } = useToast();
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const privacyTriggerRef = useRef<HTMLButtonElement>(null);
  const privacyCloseButtonRef = useRef<HTMLButtonElement>(null);
  const [registrationMode, setRegistrationMode] = useState<RegistrationMode>("resident");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [province, setProvince] = useState("");
  const [provinceQuery, setProvinceQuery] = useState("");
  const [district, setDistrict] = useState("");
  const [districtQuery, setDistrictQuery] = useState("");
  const [subdistrict, setSubdistrict] = useState("");
  const [subdistrictQuery, setSubdistrictQuery] = useState("");
  const [villageId, setVillageId] = useState("");
  const [villageQuery, setVillageQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const loginHref = callbackUrl
    ? `/auth/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
    : "/auth/login";

  useEffect(() => {
    if (!draftLoaded) {
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
  }, [draftLoaded]);

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

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const privacyTrigger = privacyTriggerRef.current;

    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    privacyCloseButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsPrivacyModalOpen(false);
        return;
      }

      if (event.key === "Tab") {
        const dialog = document.getElementById("privacy-policy-dialog");
        const focusableElements = dialog?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (!focusableElements?.length) {
          return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        if (event.shiftKey && document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        } else if (!event.shiftKey && document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
      privacyTrigger?.focus();
    };
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

  useEffect(() => {
    if (provinceOptions.includes(province)) {
      setProvinceQuery(province);
    }
  }, [province, provinceOptions]);

  useEffect(() => {
    if (districtOptions.includes(district)) {
      setDistrictQuery(district);
    }
  }, [district, districtOptions]);

  useEffect(() => {
    if (subdistrictOptions.includes(subdistrict)) {
      setSubdistrictQuery(subdistrict);
    }
  }, [subdistrict, subdistrictOptions]);

  useEffect(() => {
    const selectedVillage = villageOptions.find((village) => village.value === villageId);
    if (selectedVillage) {
      setVillageQuery(selectedVillage.label ?? selectedVillage.value);
    }
  }, [villageId, villageOptions]);

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

    saveRegistrationDraft({
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

      const startData = (await startResponse.json()) as { registrationId?: string; outcome?: string };
      const params = new URLSearchParams({
        mode: "signup",
      });

      if (startData.registrationId) {
        params.set("registrationId", startData.registrationId);
      }
      if (startData.outcome === "RESUME_EXISTING_CHALLENGE") params.set("resumed", "1");

      if (callbackUrl) {
        params.set("callbackUrl", callbackUrl);
      }

      success("ส่งรหัส OTP แล้ว", "กรุณาตรวจสอบข้อความ SMS เพื่อยืนยันการสมัครสมาชิก");
      router.push(`/auth/verify-otp?${params.toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ส่ง OTP ไม่สำเร็จ");
      showError("ส่งรหัส OTP ไม่สำเร็จ", "กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-white/90 bg-white/90 p-6 shadow-xl shadow-emerald-950/10 ring-1 ring-emerald-100/80 backdrop-blur sm:p-8">
      <div className="mb-3">
        <Link href="/landing" className="text-sm font-medium text-green-700 hover:underline">
          กลับไปหน้าเว็บไซต์หมู่บ้าน
        </Link>
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">สมัครสมาชิก</h2>
      <p className="text-sm text-gray-500 mb-4">
        ยืนยันเบอร์โทรศัพท์และระบุข้อมูลพื้นที่ของคุณเพื่อเข้าใช้งานระบบหมู่บ้าน
      </p>

      <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-800">
        สมัครสมาชิกสำหรับลูกบ้านทั่วไปเท่านั้น หลังสมัครแล้วถ้ายังไม่ผูกเลขบ้าน จะใช้งานได้เฉพาะข้อมูลสาธารณะและหน้าขอผูกเลขบ้าน
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">ข้อมูลบัญชีและยืนยันตัวตน</h3>
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

        </section>

        <section className="space-y-4 border-t border-gray-100 pt-5">
          <h3 className="text-sm font-semibold text-gray-900">พื้นที่และหมู่บ้านที่เกี่ยวข้อง</h3>
        <SuggestCombobox
          id="register-province"
          name="register-province-search-query"
          autoComplete="new-password"
          label="จังหวัด"
          value={provinceQuery}
          options={provinceOptions.map((option) => ({ value: option }))}
          placeholder="เลือกหรือพิมพ์จังหวัด"
          helperText="เลือกจังหวัดจากรายการ"
          onChange={(nextValue) => {
            setProvinceQuery(nextValue);
            setProvince("");
            setDistrict("");
            setDistrictQuery("");
            setSubdistrict("");
            setSubdistrictQuery("");
            setVillageId("");
            setVillageQuery("");
            setError(null);
          }}
          onSelect={(option) => {
            setProvince(option.value);
            setProvinceQuery(option.label ?? option.value);
            setDistrict("");
            setDistrictQuery("");
            setSubdistrict("");
            setSubdistrictQuery("");
            setVillageId("");
            setVillageQuery("");
            setError(null);
          }}
        />

        <SuggestCombobox
          id="register-district"
          name="register-district-search-query"
          autoComplete="new-password"
          label="อำเภอ"
          value={districtQuery}
          options={districtOptions.map((option) => ({ value: option }))}
          placeholder={province ? "เลือกหรือพิมพ์อำเภอ" : "เลือกจังหวัดก่อน"}
          helperText={province ? "เลือกอำเภอจากรายการ" : "เลือกจังหวัดก่อนเพื่อเปิดอำเภอ"}
          disabled={!province}
          onChange={(nextValue) => {
            setDistrictQuery(nextValue);
            setDistrict("");
            setSubdistrict("");
            setSubdistrictQuery("");
            setVillageId("");
            setVillageQuery("");
            setError(null);
          }}
          onSelect={(option) => {
            setDistrict(option.value);
            setDistrictQuery(option.label ?? option.value);
            setSubdistrict("");
            setSubdistrictQuery("");
            setVillageId("");
            setVillageQuery("");
            setError(null);
          }}
        />

        <SuggestCombobox
          id="register-subdistrict"
          name="register-subdistrict-search-query"
          autoComplete="new-password"
          label="ตำบล"
          value={subdistrictQuery}
          options={subdistrictOptions.map((option) => ({ value: option }))}
          placeholder={district ? "เลือกหรือพิมพ์ตำบล" : "เลือกอำเภอก่อน"}
          helperText={district ? "เลือกตำบลจากรายการ" : "เลือกอำเภอก่อนเพื่อเปิดตำบล"}
          disabled={!district}
          onChange={(nextValue) => {
            setSubdistrictQuery(nextValue);
            setSubdistrict("");
            setVillageId("");
            setVillageQuery("");
            setError(null);
          }}
          onSelect={(option) => {
            setSubdistrict(option.value);
            setSubdistrictQuery(option.label ?? option.value);
            setVillageId("");
            setVillageQuery("");
            setError(null);
          }}
        />

        <SuggestCombobox
          id="register-village"
          name="register-village-search-query"
          autoComplete="new-password"
          label="หมู่บ้าน"
          value={villageQuery}
          options={villageOptions}
          placeholder={subdistrict ? "เลือกหรือพิมพ์ชื่อหมู่บ้าน" : "เลือกตำบลก่อน"}
          helperText="เลือกหมู่บ้านจากรายการหลังจากระบุตำบลแล้ว"
          disabled={!subdistrict}
          onChange={(nextValue) => {
            setVillageQuery(nextValue);
            setVillageId("");
            setError(null);
          }}
          onSelect={(option) => {
            setVillageId(option.value);
            setVillageQuery(option.label ?? option.value);
            setError(null);
          }}
        />

        </section>

        <div className="flex items-start gap-3 rounded-lg bg-gray-50 p-3">
          <input type="checkbox" required className="mt-1 h-4 w-4 cursor-pointer accent-green-600 focus:ring-2 focus:ring-green-500" id="consent" />
          <label htmlFor="consent" className="cursor-pointer text-sm text-gray-600">
            ฉันยอมรับ{" "}
            <button
              type="button"
              ref={privacyTriggerRef}
              className="cursor-pointer text-green-600 hover:underline focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
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

      {isPrivacyModalOpen && typeof document !== "undefined"
        ? createPortal(
        <div className="fixed inset-0 z-[200] grid min-h-[100dvh] w-screen place-items-center bg-slate-950/50 p-4">
          <button type="button" aria-label="Close privacy policy" className="absolute inset-0 cursor-pointer" onClick={() => setIsPrivacyModalOpen(false)} />
          <div
            id="privacy-policy-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Privacy policy"
            className="relative z-10 max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-xl border border-gray-200 bg-white p-5 shadow-2xl sm:p-6"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-gray-900">นโยบายความเป็นส่วนตัว</h3>
              <button
                type="button"
                ref={privacyCloseButtonRef}
                onClick={() => setIsPrivacyModalOpen(false)}
                className="cursor-pointer rounded-lg border border-gray-200 px-3 py-1 text-sm text-gray-600 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
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
        </div>,
        document.body
      )
        : null}
    </div>
  );
}
