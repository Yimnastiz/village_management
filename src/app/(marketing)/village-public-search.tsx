"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPinned, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SuggestCombobox } from "@/components/ui/suggest-combobox";
import type { ThaiProvince } from "@/lib/thai-geography";

type VillageOption = {
  id: string;
  slug: string;
  name: string;
  province: string | null;
  district: string | null;
  subdistrict: string | null;
};

type VillagePublicSearchProps = {
  villages: VillageOption[];
  thaiGeography: ThaiProvince[];
};

function unique(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort(
    (left, right) => left.localeCompare(right, "th")
  );
}

function normalizeForSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "");
}

export function VillagePublicSearch({ villages, thaiGeography }: VillagePublicSearchProps) {
  const router = useRouter();
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [subdistrict, setSubdistrict] = useState("");
  const [villageName, setVillageName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const provinceOptions = useMemo(
    () => thaiGeography.map((provinceItem) => ({ value: provinceItem.name, label: provinceItem.name })),
    [thaiGeography]
  );

  const selectedProvince = useMemo(
    () => thaiGeography.find((provinceItem) => provinceItem.name === province) ?? null,
    [province, thaiGeography]
  );

  const districtOptions = useMemo(
    () => (selectedProvince?.districts ?? []).map((districtItem) => districtItem.name),
    [selectedProvince]
  );

  const selectedDistrict = useMemo(
    () => selectedProvince?.districts.find((districtItem) => districtItem.name === district) ?? null,
    [district, selectedProvince]
  );

  const subdistrictOptions = useMemo(
    () => selectedDistrict?.subdistricts ?? [],
    [selectedDistrict]
  );

  const filteredVillages = useMemo(
    () =>
      villages.filter(
        (village) =>
          (!province || village.province === province) &&
          (!district || village.district === district) &&
          (!subdistrict || village.subdistrict === subdistrict)
      ),
    [district, province, subdistrict, villages]
  );

  const villageSuggestions = useMemo(() => {
    const keyword = normalizeForSearch(villageName.trim());
    return filteredVillages
      .filter((village) => {
        if (!keyword) {
          return true;
        }

        const haystack = [village.name, village.subdistrict, village.district, village.province]
          .filter(Boolean)
          .join(" ");
        return normalizeForSearch(haystack).includes(keyword);
      })
      .sort((left, right) => left.name.localeCompare(right.name, "th"));
  }, [filteredVillages, villageName]);

  const matchedVillage = useMemo(() => {
    const keyword = normalizeForSearch(villageName.trim());
    if (!keyword) {
      return null;
    }

    return (
      filteredVillages.find((village) => normalizeForSearch(village.name) === keyword) ?? null
    );
  }, [filteredVillages, villageName]);

  const isProvinceValid = useMemo(
    () => !province || thaiGeography.some((provinceItem) => provinceItem.name === province),
    [province, thaiGeography]
  );

  const isDistrictValid = useMemo(
    () => !district || districtOptions.includes(district),
    [district, districtOptions]
  );

  const isSubdistrictValid = useMemo(
    () => !subdistrict || subdistrictOptions.includes(subdistrict),
    [subdistrict, subdistrictOptions]
  );

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isProvinceValid || !isDistrictValid || !isSubdistrictValid) {
      setError("กรุณาเลือกจังหวัด อำเภอ และตำบลจากรายการที่แนะนำเท่านั้น");
      return;
    }

    if (!matchedVillage) {
      setError("กรุณาเลือกชื่อหมู่บ้านจากรายการแนะนำ");
      return;
    }

    setError(null);
    router.push(`/${matchedVillage.slug}`);
  };

  return (
    <div className="mx-auto mt-10 max-w-5xl rounded-3xl border border-white/15 bg-white/10 p-5 shadow-2xl backdrop-blur md:p-6">
      <div className="mb-4 flex items-start gap-3 text-left">
        <div className="rounded-2xl bg-white/15 p-3">
          <MapPinned className="h-6 w-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-white">ค้นหาหน้าสาธารณะของหมู่บ้าน</h2>
          <p className="mt-1 text-sm text-green-100">
            เลือกจังหวัด อำเภอ ตำบล และชื่อหมู่บ้านเพื่อดูข้อมูลสาธารณะ ข่าวสาร และประกาศของหมู่บ้านนั้น
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        <SuggestCombobox
          id="public-province"
          label="จังหวัด"
          value={province}
          options={provinceOptions}
          placeholder="เลือกหรือพิมพ์จังหวัด"
          labelClassName="text-white"
          helperClassName="text-green-100"
          inputClassName="bg-white text-gray-900"
          onChange={(nextValue) => {
            setProvince(nextValue);
            setDistrict("");
            setSubdistrict("");
            setVillageName("");
            setError(null);
          }}
        />

        <SuggestCombobox
          id="public-district"
          label="อำเภอ"
          value={district}
          options={districtOptions.map((districtOption) => ({ value: districtOption }))}
          placeholder={province ? "เลือกหรือพิมพ์อำเภอ" : "เลือกจังหวัดก่อน"}
          disabled={!province}
          labelClassName="text-white"
          helperClassName="text-green-100"
          inputClassName="bg-white text-gray-900"
          onChange={(nextValue) => {
            setDistrict(nextValue);
            setSubdistrict("");
            setVillageName("");
            setError(null);
          }}
        />

        <SuggestCombobox
          id="public-subdistrict"
          label="ตำบล"
          value={subdistrict}
          options={subdistrictOptions.map((subdistrictOption) => ({ value: subdistrictOption }))}
          placeholder={district ? "เลือกหรือพิมพ์ตำบล" : "เลือกอำเภอก่อน"}
          disabled={!district}
          labelClassName="text-white"
          helperClassName="text-green-100"
          inputClassName="bg-white text-gray-900"
          onChange={(nextValue) => {
            setSubdistrict(nextValue);
            setVillageName("");
            setError(null);
          }}
        />

        <div className="xl:col-span-2">
          <SuggestCombobox
            id="public-village"
            label="ชื่อหมู่บ้าน"
            value={villageName}
            options={villageSuggestions.map((village) => ({
              value: village.name,
              label: village.name,
              description: [village.subdistrict, village.district, village.province].filter(Boolean).join(" / "),
            }))}
            placeholder="พิมพ์ชื่อหมู่บ้าน เช่น Kontai"
            helperText={
              villageSuggestions.length > 0
                ? `มีคำแนะนำ ${villageSuggestions.length} รายการจากฐานข้อมูล`
                : villageName.trim()
                  ? "ไม่พบชื่อหมู่บ้านที่ตรงกับคำค้นในเงื่อนไขที่เลือก"
                  : "ไม่พบชื่อหมู่บ้านในเงื่อนไขที่เลือก"
            }
            emptyMessage="ไม่พบชื่อหมู่บ้านในเงื่อนไขที่เลือก"
            labelClassName="text-white"
            helperClassName="text-green-100"
            inputClassName="bg-white text-gray-900"
            onChange={(nextValue) => {
              setVillageName(nextValue);
              setError(null);
            }}
          />
        </div>

        <div className="xl:col-span-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="text-left text-sm text-green-100">
            {matchedVillage ? (
              <span>
                หมู่บ้านที่เลือก: <strong className="text-white">{matchedVillage.name}</strong>
              </span>
            ) : (
              <span>พิมพ์ชื่อหมู่บ้านแล้วเลือกจากรายการแนะนำเพื่อเปิดหน้าสาธารณะ</span>
            )}
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-green-800 transition hover:bg-green-50"
          >
            <Search className="h-4 w-4" />
            ดูข้อมูลหมู่บ้าน
          </button>
        </div>

        {error && <p className="xl:col-span-5 text-sm text-red-100">{error}</p>}
      </form>
    </div>
  );
}