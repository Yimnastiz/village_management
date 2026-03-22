import Link from "next/link";
import { PhoneCall, Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";

export default async function AdminContactsPage() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  if (!isAdminUser(session)) redirect("/resident");

  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, status: "ACTIVE" },
    select: { villageId: true },
  });
  if (!membership) redirect("/auth/login");

  const contacts = await prisma.contactDirectory.findMany({
    where: { villageId: membership.villageId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      role: true,
      phone: true,
      category: true,
      isPublic: true,
      sortOrder: true,
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">รายชื่อผู้ติดต่อ</h1>
          <p className="text-sm text-gray-500 mt-1">เพิ่ม แก้ไข และลบข้อมูลติดต่อหมู่บ้าน</p>
        </div>
        <Link href="/admin/contacts/new">
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" /> เพิ่มผู้ติดต่อ
          </Button>
        </Link>
      </div>

      {contacts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <PhoneCall className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600">ยังไม่มีข้อมูลผู้ติดต่อ</p>
        </div>
      ) : (
        <div className="space-y-3">
          {contacts.map((contact) => (
            <Link
              key={contact.id}
              href={`/admin/contacts/${contact.id}`}
              className="block rounded-xl border border-gray-200 bg-white p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={contact.isPublic ? "success" : "info"}>
                      {contact.isPublic ? "สาธารณะ" : "เฉพาะลูกบ้าน"}
                    </Badge>
                    <Badge variant="outline">ลำดับ {contact.sortOrder}</Badge>
                  </div>
                  <p className="font-medium text-gray-900">{contact.name}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {contact.role || "ไม่ระบุตำแหน่ง"}
                    {contact.phone ? ` • ${contact.phone}` : ""}
                    {contact.category ? ` • ${contact.category}` : ""}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
