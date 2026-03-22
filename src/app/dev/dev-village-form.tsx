"use client";

import { useMemo, useState } from "react";
import { createVillageAction } from "./actions";
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
    <form
      action={createVillageAction}
      className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3"
    >
      <input
        name="slug"
        required
        placeholder="slug (e.g. ban-nong-khai)"
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
        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
      >
        Add / Update Village
      </button>
    </form>
  );
}
