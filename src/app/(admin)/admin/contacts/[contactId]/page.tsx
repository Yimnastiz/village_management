import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { DeleteContactButton } from "./delete-button";

interface PageProps {
  params: Promise<{ contactId: string }>;
}

export default async function ContactDetailPage({ params }: PageProps) {
  const { contactId } = await params;

  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  if (!isAdminUser(session)) redirect("/resident");

  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, status: "ACTIVE" },
    select: { villageId: true },
  });
  if (!membership) redirect("/auth/login");

  const contact = await prisma.contactDirectory.findFirst({
    where: { id: contactId, villageId: membership.villageId },
  });
  if (!contact) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">รายละเอียดผู้ติดต่อ</h1>
          <p className="text-sm text-gray-500 mt-1">ตรวจสอบหรือแก้ไขข้อมูลผู้ติดต่อ</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/admin/contacts/${contact.id}/edit`}>
            <Button variant="outline">แก้ไข</Button>
          </Link>
          <DeleteContactButton contactId={contact.id} />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant={contact.isPublic ? "success" : "info"}>
            {contact.isPublic ? "สาธารณะ" : "เฉพาะลูกบ้าน"}
          </Badge>
          <Badge variant="outline">ลำดับ {contact.sortOrder}</Badge>
          {contact.category && <Badge variant="outline">{contact.category}</Badge>}
        </div>
        <h2 className="text-xl font-semibold text-gray-900">{contact.name}</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">ตำแหน่ง</p>
            <p className="text-gray-900 mt-1">{contact.role || "ไม่ระบุ"}</p>
          </div>
          <div>
            <p className="text-gray-500">เบอร์โทร</p>
            <p className="text-gray-900 mt-1">{contact.phone || "ไม่ระบุ"}</p>
          </div>
          <div>
            <p className="text-gray-500">อีเมล</p>
            <p className="text-gray-900 mt-1">{contact.email || "ไม่ระบุ"}</p>
          </div>
          <div>
            <p className="text-gray-500">ที่อยู่</p>
            <p className="text-gray-900 mt-1">{contact.address || "ไม่ระบุ"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
