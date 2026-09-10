import { notFound } from "next/navigation";
import { getSlugVariants, normalizeVillageSlugParam } from "@/lib/village-slug";
import { getConfiguredVillage } from "@/lib/configured-village";
import { GuestVillageTopbar } from "./guest-village-topbar";

interface VillageLayoutProps {
  children: React.ReactNode;
  params: Promise<{ villageSlug: string }>;
}

export default async function VillageLayout({ children, params }: VillageLayoutProps) {
  const { villageSlug: rawVillageSlug } = await params;
  const requestedSlug = normalizeVillageSlugParam(rawVillageSlug);
  const currentVillage = await getConfiguredVillage();
  if (!getSlugVariants(requestedSlug).includes(currentVillage.slug)) notFound();
  const base = `/${currentVillage.slug}`;

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-gray-50 [--app-sticky-top:6rem] xl:[--app-sticky-top:4rem]">
      <GuestVillageTopbar base={base} villageName={currentVillage.name} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-3 sm:px-6 sm:py-5 lg:px-8">
        {children}
      </main>
      <footer className="bg-emerald-950 px-4 py-5 text-center text-xs text-emerald-100 sm:text-sm">
        © {new Date().getFullYear()} ระบบหมู่บ้านอัจฉริยะ · หมู่บ้าน {currentVillage.name}
      </footer>
    </div>
  );
}
