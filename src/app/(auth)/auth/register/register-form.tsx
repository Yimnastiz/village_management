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

function unique(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
    .sort((a, b) => a.localeCompare(b));
}

export function RegisterForm({ villages, thaiGeography, callbackUrl }: RegisterFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
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
    if (!normalizedName || !normalizedPhone || !province || !district || !subdistrict || !villageId) {
      setError("Please complete all required fields.");
      return;
    }

    if (!/^\d{10}$/.test(normalizedPhone)) {
      setError("Phone number must be exactly 10 digits.");
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
            "Failed to send OTP."
        );
      }

      const params = new URLSearchParams({
        mode: "signup",
        phone: normalizedPhone,
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
      setError(err instanceof Error ? err.message : "Failed to send OTP.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8">
      <h2 className="text-xl font-bold text-gray-900 mb-2">Create Account</h2>
      <p className="text-sm text-gray-500 mb-6">
        Verify your phone and select your location before joining the village system.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Full Name"
          name="name"
          placeholder="John Doe"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <Input
          label="Phone Number"
          name="phone"
          type="tel"
          placeholder="0812345678"
          value={phone}
          onChange={(e) => setPhone(normalizePhone10(e.target.value))}
          inputMode="numeric"
          maxLength={10}
          pattern="[0-9]{10}"
          title="Phone number must be exactly 10 digits"
          required
        />

        <Select
          label="Province"
          value={province}
          onChange={(e) => {
            setProvince(e.target.value);
            setDistrict("");
            setSubdistrict("");
            setVillageId("");
          }}
          options={provinceOptions}
          placeholder="Select province"
          required
        />

        <Select
          label="District"
          value={district}
          onChange={(e) => {
            setDistrict(e.target.value);
            setSubdistrict("");
            setVillageId("");
          }}
          options={districtOptions}
          placeholder={province ? "Select district" : "Select province first"}
          required
          disabled={!province}
        />

        <Select
          label="Subdistrict"
          value={subdistrict}
          onChange={(e) => {
            setSubdistrict(e.target.value);
            setVillageId("");
          }}
          options={subdistrictOptions}
          placeholder={district ? "Select subdistrict" : "Select district first"}
          required
          disabled={!district}
        />

        <Select
          label="Village"
          value={villageId}
          onChange={(e) => setVillageId(e.target.value)}
          options={villageOptions}
          placeholder={subdistrict ? "Select village" : "Select subdistrict first"}
          required
          disabled={!subdistrict}
        />

        <div className="flex items-start gap-3">
          <input type="checkbox" required className="mt-1" id="consent" />
          <label htmlFor="consent" className="text-sm text-gray-600">
            I accept the{" "}
            <Link href="/consent" className="text-green-600 hover:underline">
              privacy policy
            </Link>
            .
          </label>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" className="w-full" isLoading={isLoading}>
          Register
        </Button>
      </form>

      <div className="mt-6 text-center text-sm text-gray-600">
        Already have an account?{" "}
        <Link href={loginHref} className="text-green-600 font-medium hover:underline">
          Sign In
        </Link>
      </div>
    </div>
  );
}
