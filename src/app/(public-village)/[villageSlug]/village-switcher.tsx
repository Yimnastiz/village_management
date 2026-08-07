"use client";

import { useRouter } from "next/navigation";
import { formatVillageLabel, formatVillageLocation } from "@/lib/village-label";

type VillageOption = {
  id: string;
  slug: string;
  name: string;
  moo: string | null;
  province: string | null;
  district: string | null;
  subdistrict: string | null;
};

type VillageSwitcherProps = {
  villages: VillageOption[];
  currentSlug: string;
};

export function VillageSwitcher({ villages, currentSlug }: VillageSwitcherProps) {
  const router = useRouter();

  return (
    <label className="flex min-w-0 items-center gap-2 text-sm text-green-100">
      <span className="hidden sm:inline">เปลี่ยนหมู่บ้าน</span>
      <select
        value={currentSlug}
        onChange={(event) => {
          const nextSlug = event.target.value;
          if (!nextSlug || nextSlug === currentSlug) return;
          router.push(`/${nextSlug}`);
        }}
        aria-label="เปลี่ยนหมู่บ้านในตำบลเดียวกัน"
        className="h-9 max-w-[9.5rem] cursor-pointer rounded-lg border border-white/25 bg-emerald-900 px-2 text-xs text-white outline-none focus:ring-2 focus:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-50 sm:max-w-[12rem] sm:text-sm"
      >
        {villages.map((village) => (
          <option key={village.id} value={village.slug}>
            {formatVillageLabel(village.name, village.moo)} · {formatVillageLocation(village)}
          </option>
        ))}
      </select>
    </label>
  );
}
