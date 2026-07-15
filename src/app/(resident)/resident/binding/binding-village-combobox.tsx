"use client";

import { ChevronDown, Search } from "lucide-react";
import { useMemo, useState } from "react";

type VillageOption = {
  id: string;
  name: string;
  province: string | null;
  district: string | null;
  subdistrict: string | null;
};

function villageLabel(village: VillageOption) {
  const location = [village.subdistrict, village.district, village.province].filter(Boolean).join(" / ");
  return location ? `${village.name} (${location})` : village.name;
}

export function BindingVillageCombobox({ villages, initialVillageId, disabled }: {
  villages: VillageOption[];
  initialVillageId?: string | null;
  disabled?: boolean;
}) {
  const initialVillage = villages.find((village) => village.id === initialVillageId) ?? null;
  const [selectedId, setSelectedId] = useState(initialVillage?.id ?? "");
  const [query, setQuery] = useState(initialVillage ? villageLabel(initialVillage) : "");
  const [open, setOpen] = useState(false);
  const filteredVillages = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("th");
    if (!keyword || selectedId) return villages.slice(0, 50);
    return villages.filter((village) => villageLabel(village).toLocaleLowerCase("th").includes(keyword)).slice(0, 50);
  }, [query, selectedId, villages]);

  return (
    <div className="relative">
      <label htmlFor="village-search" className="mb-1 block text-sm font-medium text-gray-700">หมู่บ้าน</label>
      <input type="hidden" name="villageId" value={selectedId} />
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          id="village-search"
          value={query}
          required
          disabled={disabled}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls="binding-village-options"
          placeholder="พิมพ์ชื่อหมู่บ้าน ตำบล อำเภอ หรือจังหวัด"
          onFocus={() => setOpen(true)}
          onChange={(event) => { setQuery(event.target.value); setSelectedId(""); setOpen(true); }}
          className="min-h-11 w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-10 text-sm disabled:bg-gray-100"
        />
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      </div>
      {open && !disabled ? (
        <div id="binding-village-options" className="absolute z-40 mt-1 max-h-64 w-full overflow-y-auto overscroll-contain rounded-xl border border-gray-200 bg-white p-1 shadow-xl">
          {filteredVillages.length ? filteredVillages.map((village) => (
            <button key={village.id} type="button" className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-green-50" onMouseDown={(event) => event.preventDefault()} onClick={() => { setSelectedId(village.id); setQuery(villageLabel(village)); setOpen(false); }}>
              <span className="block font-medium text-gray-900">{village.name}</span>
              <span className="block text-xs text-gray-500">{[village.subdistrict, village.district, village.province].filter(Boolean).join(" / ")}</span>
            </button>
          )) : <p className="px-3 py-4 text-center text-sm text-gray-500">ไม่พบหมู่บ้านที่ค้นหา</p>}
        </div>
      ) : null}
      <p className="mt-1 text-xs text-gray-500">ค้นหาแล้วเลือกหมู่บ้านจากรายการแนะนำ</p>
    </div>
  );
}
