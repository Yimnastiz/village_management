import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { DownloadForm } from "../../download-form";

interface PageProps {
  params: Promise<{ fileId: string }>;
}

export default async function Page({ params }: PageProps) {
  const { fileId } = await params;

  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  if (!isAdminUser(session)) redirect("/resident");

  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, status: "ACTIVE" },
    select: { villageId: true },
  });
  if (!membership) redirect("/auth/login");

  const file = await prisma.downloadFile.findFirst({
    where: { id: fileId, villageId: membership.villageId },
  });
  if (!file) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">แก้ไขเอกสาร</h1>
      <DownloadForm
        mode="edit"
        fileId={file.id}
        defaultValues={{
          title: file.title,
          description: file.description || "",
          category: file.category || "",
          stage: file.stage,
          visibility: file.visibility,
        }}
      />
    </div>
  );
}
