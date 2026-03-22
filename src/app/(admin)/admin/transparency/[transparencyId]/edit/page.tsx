import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { TransparencyForm } from "../../transparency-form";

interface PageProps {
  params: Promise<{ transparencyId: string }>;
}

export default async function EditTransparencyPage({ params }: PageProps) {
  const { transparencyId } = await params;

  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  if (!isAdminUser(session)) redirect("/resident");

  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, status: "ACTIVE" },
    select: { villageId: true },
  });
  if (!membership) redirect("/auth/login");

  const record = await prisma.transparencyRecord.findFirst({
    where: { id: transparencyId, villageId: membership.villageId },
  });
  if (!record) notFound();

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/admin/transparency/${transparencyId}`} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">แก้ไขรายการความโปร่งใส</h1>
      </div>
      <TransparencyForm
        mode="edit"
        transparencyId={transparencyId}
        defaultValues={{
          title: record.title,
          description: record.description ?? "",
          category: record.category ?? "",
          amount: record.amount != null ? String(record.amount) : "",
          fiscalYear: record.fiscalYear ?? "",
          stage: record.stage,
          visibility: record.visibility,
        }}
      />
    </div>
  );
}
