"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPinned, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SuggestCombobox } from "@/components/ui/suggest-combobox";
import type { ThaiProvince } from "@/lib/thai-geography";
import { formatVillageLabel, villageSearchText } from "@/lib/village-label";

type VillageOption = {
  id: string;
  slug: string;
  name: string;
  moo: string | null;
  province: string | null;
  district: string | null;
  subdistrict: string | null;
};

type VillagePublicSearchProps = {
  villages: VillageOption[];
  thaiGeography: ThaiProvince[];
};

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
  const [selectedVillageId, setSelectedVillageId] = useState("");
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

        return normalizeForSearch(villageSearchText(village)).includes(keyword);
      })
      .sort((left, right) => left.name.localeCompare(right.name, "th"));
  }, [filteredVillages, villageName]);

  const matchedVillage = useMemo(() => {
    const keyword = normalizeForSearch(villageName.trim());
    if (!keyword) {
      return null;
    }

    return (
      filteredVillages.find((village) => village.id === selectedVillageId) ??
      filteredVillages.find((village) => normalizeForSearch(formatVillageLabel(village.name, village.moo)) === keyword) ??
      (filteredVillages.filter((village) => normalizeForSearch(village.name) === keyword).length === 1
        ? filteredVillages.find((village) => normalizeForSearch(village.name) === keyword) ?? null
        : null)
    );
  }, [filteredVillages, selectedVillageId, villageName]);

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
    <div className="mx-auto mt-8 max-w-5xl rounded-2xl border border-white/15 bg-white/10 p-4 shadow-xl backdrop-blur sm:p-5">
      <div className="mb-3 flex items-start gap-2.5 text-left">
        <div className="rounded-xl bg-white/15 p-2">
          <MapPinned className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-white">ค้นหาหน้าสาธารณะของหมู่บ้าน</h2>
          <p className="mt-1 text-sm text-green-100">
            เลือกจังหวัด อำเภอ ตำบล และชื่อหมู่บ้านเพื่อดูข้อมูลสาธารณะ ข่าวสาร และประกาศของหมู่บ้านนั้น
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-5">
        <SuggestCombobox
          id="public-province"
          name="public-province-search-query"
          autoComplete="new-password"
          label="จังหวัด"
          value={province}
          options={provinceOptions}
          placeholder="เลือกหรือพิมพ์จังหวัด"
          labelClassName="text-white"
          helperClassName="text-green-100"
          inputClassName="h-10 bg-white py-2 text-gray-900"
          onChange={(nextValue) => {
            setProvince(nextValue);
            setDistrict("");
            setSubdistrict("");
            setVillageName("");
            setSelectedVillageId("");
            setError(null);
          }}
        />

        <SuggestCombobox
          id="public-district"
          name="public-district-search-query"
          autoComplete="new-password"
          label="อำเภอ"
          value={district}
          options={districtOptions.map((districtOption) => ({ value: districtOption }))}
          placeholder={province ? "เลือกหรือพิมพ์อำเภอ" : "เลือกจังหวัดก่อน"}
          disabled={!province}
          labelClassName="text-white"
          helperClassName="text-green-100"
          inputClassName="h-10 bg-white py-2 text-gray-900"
          onChange={(nextValue) => {
            setDistrict(nextValue);
            setSubdistrict("");
            setVillageName("");
            setSelectedVillageId("");
            setError(null);
          }}
        />

        <SuggestCombobox
          id="public-subdistrict"
          name="public-subdistrict-search-query"
          autoComplete="new-password"
          label="ตำบล"
          value={subdistrict}
          options={subdistrictOptions.map((subdistrictOption) => ({ value: subdistrictOption }))}
          placeholder={district ? "เลือกหรือพิมพ์ตำบล" : "เลือกอำเภอก่อน"}
          disabled={!district}
          labelClassName="text-white"
          helperClassName="text-green-100"
          inputClassName="h-10 bg-white py-2 text-gray-900"
          onChange={(nextValue) => {
            setSubdistrict(nextValue);
            setVillageName("");
            setSelectedVillageId("");
            setError(null);
          }}
        />

        <div className="xl:col-span-2">
          <SuggestCombobox
            id="public-village"
            name="public-village-search-query"
            autoComplete="new-password"
            label="ชื่อหมู่บ้าน"
            value={villageName}
            options={villageSuggestions.map((village) => ({
              value: formatVillageLabel(village.name, village.moo),
              label: formatVillageLabel(village.name, village.moo),
              description: villageSearchText(village),
            }))}
            placeholder="พิมพ์ชื่อหมู่บ้าน เช่น รักไทย"
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
            inputClassName="h-10 bg-white py-2 text-gray-900"
            onChange={(nextValue) => {
              setVillageName(nextValue);
              setSelectedVillageId("");
              setError(null);
            }}
            onSelect={(option) => {
              const selected = villageSuggestions.find(
                (village) => formatVillageLabel(village.name, village.moo) === option.value
              );
              setSelectedVillageId(selected?.id ?? "");
            }}
          />
        </div>

        <div className="xl:col-span-5 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-left text-xs text-green-100 sm:text-sm">
            {matchedVillage ? (
              <span>
                หมู่บ้านที่เลือก: <strong className="text-white">{formatVillageLabel(matchedVillage.name, matchedVillage.moo)}</strong>
              </span>
            ) : (
              <span>พิมพ์ชื่อหมู่บ้านแล้วเลือกจากรายการแนะนำเพื่อเปิดหน้าสาธารณะ</span>
            )}
          </div>
          <Button
            type="submit"
            variant="ghost"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-green-800 transition hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-white/80 focus:ring-offset-2 focus:ring-offset-green-800"
          >
            <Search className="h-4 w-4" />
            ดูข้อมูลหมู่บ้าน
          </Button>
        </div>

        {error && <p className="xl:col-span-5 text-sm text-red-100">{error}</p>}
      </form>
    </div>
  );
}
