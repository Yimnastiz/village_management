"use client";

import { useRouter } from "next/navigation";

type VillageOption = {
  id: string;
  slug: string;
  name: string;
};

type VillageSwitcherProps = {
  villages: VillageOption[];
  currentSlug: string;
};

export function VillageSwitcher({ villages, currentSlug }: VillageSwitcherProps) {
  const router = useRouter();

  return (
    <label className="flex items-center gap-2 text-sm text-green-100">
      <span className="hidden sm:inline">เปลี่ยนหมู่บ้าน</span>
      <select
        value={currentSlug}
        onChange={(event) => {
          const nextSlug = event.target.value;
          if (!nextSlug || nextSlug === currentSlug) return;
          router.push(`/${nextSlug}`);
        }}
        className="max-w-[180px] rounded-md border border-white/30 bg-green-700 px-2 py-1 text-sm text-white"
      >
        {villages.map((village) => (
          <option key={village.id} value={village.slug}>
            {village.name}
          </option>
        ))}
      </select>
    </label>
  );
}
