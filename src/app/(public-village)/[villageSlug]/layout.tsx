import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSlugVariants, normalizeVillageSlugParam } from "@/lib/village-slug";
import { GuestVillageTopbar } from "./guest-village-topbar";

interface VillageLayoutProps {
  children: React.ReactNode;
  params: Promise<{ villageSlug: string }>;
}

export default async function VillageLayout({ children, params }: VillageLayoutProps) {
  const { villageSlug: rawVillageSlug } = await params;
  const requestedSlug = normalizeVillageSlugParam(rawVillageSlug);
  const currentVillage = await prisma.village.findFirst({
    where: { slug: { in: getSlugVariants(requestedSlug) }, isActive: true },
    select: { slug: true, name: true, province: true, district: true, subdistrict: true },
  });
  if (!currentVillage) notFound();

  // Switching is intentionally scoped to the current administrative subdistrict.
  const hasCompleteLocation = Boolean(currentVillage.province && currentVillage.district && currentVillage.subdistrict);
  const villages = await prisma.village.findMany({
    where: hasCompleteLocation ? {
      isActive: true,
      province: currentVillage.province,
      district: currentVillage.district,
      subdistrict: currentVillage.subdistrict,
    } : {
      isActive: true,
      slug: currentVillage.slug,
    },
    orderBy: [{ name: "asc" }],
    select: { id: true, slug: true, name: true },
  });
  const base = `/${currentVillage.slug}`;

  return (
    <div className="min-h-screen overflow-x-clip bg-gray-50 [--app-sticky-top:6rem]">
      <GuestVillageTopbar base={base} villageName={currentVillage.name} villages={villages} currentSlug={currentVillage.slug} />
      <main className="mx-auto min-h-[60vh] w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
        {children}
      </main>
      <footer className="bg-emerald-950 px-4 py-5 text-center text-xs text-emerald-100 sm:text-sm">
        © {new Date().getFullYear()} ระบบหมู่บ้านอัจฉริยะ · หมู่บ้าน {currentVillage.name}
      </footer>
    </div>
  );
}
