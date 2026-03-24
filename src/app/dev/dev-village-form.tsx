"use client";

import { useActionState, useMemo, useState } from "react";
import {
  createVillageAction,
  repairVillageSlugAction,
  type VillageActionState,
} from "./actions";
import type { ThaiProvince } from "@/lib/thai-geography";

type VillageOption = {
  id: string;
  name: string;
  province: string | null;
  district: string | null;
  subdistrict: string | null;
};

type DevVillageFormProps = {
  thaiGeography: ThaiProvince[];
  villages: VillageOption[];
};

export function DevVillageForm({ thaiGeography, villages }: DevVillageFormProps) {
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [subdistrict, setSubdistrict] = useState("");
  const [state, formAction, isPending] = useActionState<VillageActionState | null, FormData>(
    createVillageAction,
    null,
  );
  const [repairState, repairFormAction, isRepairing] = useActionState<VillageActionState | null, FormData>(
    repairVillageSlugAction,
    null,
  );

  const selectedProvince = useMemo(
    () => thaiGeography.find((p) => p.name === province) ?? null,
    [province, thaiGeography]
  );

  const selectedDistrict = useMemo(
    () => selectedProvince?.districts.find((d) => d.name === district) ?? null,
    [district, selectedProvince]
  );

  const districtOptions = selectedProvince?.districts.map((d) => d.name) ?? [];
  const subdistrictOptions = selectedDistrict?.subdistricts ?? [];

  const villageSuggestions = useMemo(
    () =>
      villages
        .filter(
          (v) =>
            (!province || v.province === province) &&
            (!district || v.district === district) &&
            (!subdistrict || v.subdistrict === subdistrict)
        )
        .map((v) => v.name),
    [province, district, subdistrict, villages]
  );

  return (
    <>
      {state && (
        <div
          className={`mt-3 rounded-lg px-4 py-3 text-sm ${
            state.success
              ? "bg-green-50 border border-green-200 text-green-800"
              : "bg-red-50 border border-red-200 text-red-800"
          }`}
        >
          {state.message}
        </div>
      )}
      {repairState && (
        <div
          className={`mt-3 rounded-lg px-4 py-3 text-sm ${
            repairState.success
              ? "bg-blue-50 border border-blue-200 text-blue-800"
              : "bg-amber-50 border border-amber-200 text-amber-900"
          }`}
        >
          {repairState.message}
        </div>
      )}
      <form
        action={formAction}
        className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3"
      >
        <input
          name="slug"
          required
          placeholder="slug (เช่น ban-nong-khai หรือ เขาทราย)"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />

      {/* Village name with suggestions from existing villages in selected location */}
      <input
        name="name"
        required
        placeholder="ชื่อหมู่บ้าน"
        list="dev-village-name-suggestions"
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />
      <datalist id="dev-village-name-suggestions">
        {villageSuggestions.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      {/* Province combobox — type or pick from dropdown */}
      <input
        name="province"
        required
        placeholder="จังหวัด"
        list="dev-province-options"
        value={province}
        onChange={(e) => {
          setProvince(e.target.value);
          setDistrict("");
          setSubdistrict("");
        }}
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />
      <datalist id="dev-province-options">
        {thaiGeography.map((p) => (
          <option key={p.name} value={p.name} />
        ))}
      </datalist>

      {/* District combobox — filtered by selected province */}
      <input
        name="district"
        required
        placeholder={province ? "อำเภอ" : "เลือกจังหวัดก่อน"}
        list="dev-district-options"
        value={district}
        onChange={(e) => {
          setDistrict(e.target.value);
          setSubdistrict("");
        }}
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />
      <datalist id="dev-district-options">
        {districtOptions.map((d) => (
          <option key={d} value={d} />
        ))}
      </datalist>

      {/* Subdistrict combobox — filtered by selected district */}
      <input
        name="subdistrict"
        required
        placeholder={district ? "ตำบล" : "เลือกอำเภอก่อน"}
        list="dev-subdistrict-options"
        value={subdistrict}
        onChange={(e) => setSubdistrict(e.target.value)}
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />
      <datalist id="dev-subdistrict-options">
        {subdistrictOptions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
      >
        {isPending ? "กำลังบันทึก..." : "Add / Update Village"}
      </button>
    </form>
      <form action={repairFormAction} className="mt-3">
        <button
          type="submit"
          disabled={isRepairing}
          className="rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
        >
          {isRepairing ? "กำลังซ่อม slug..." : "Repair Existing Garbled Slugs"}
        </button>
      </form>
    </>
  );
}
