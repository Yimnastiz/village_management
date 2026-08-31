import { redirect } from "next/navigation";

export default async function VillageAdminsPage({ params }: { params: Promise<{ villageId: string }> }) {
  const { villageId } = await params;
  redirect(`/superadmin/villages/${villageId}/users?view=admins`);
}
