import { PublicNavbar } from "@/components/layout/public-navbar";
import { PublicFooter } from "@/components/layout/public-footer";
import { ConfiguredVillageError, getConfiguredVillage } from "@/lib/configured-village";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  let villageHref: string | undefined;
  try { villageHref = `/${(await getConfiguredVillage()).slug}`; } catch (error) { if (!(error instanceof ConfiguredVillageError)) throw error; }
  return (
    <div className="flex flex-col min-h-screen">
      <PublicNavbar villageHref={villageHref} />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}
