import { redirect } from "next/navigation";

export default async function VillageWorkspacePage({ params }: { params: Promise<{ villageId: string }> }) {
  const { villageId } = await params;
  redirect(`/superadmin/villages/${villageId}/overview`);
}
