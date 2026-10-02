import { redirect } from "next/navigation";

interface PageProps { params: Promise<{ villageSlug: string }> }

export default async function VillageInfoRedirect({ params }: PageProps) {
  const { villageSlug } = await params;
  redirect(`/${villageSlug}`);
}
