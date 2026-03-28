import Link from "next/link";
import { PhoneCall, Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminListToolbar } from "@/components/ui/admin-list-toolbar";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";

type PageProps = {
  searchParams?: Promise<{ q?: string; visibility?: string; sort?: string }>;
};

export default async function AdminContactsPage({ searchParams }: PageProps) {
  const params = (searchParams ? await searchParams : {}) ?? {};
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");
  if (!isAdminUser(session)) redirect("/resident");

  const membership = await prisma.villageMembership.findFirst({
    where: { userId: session.id, status: "ACTIVE" },
    select: { villageId: true },
  });
  if (!membership) redirect("/auth/login");

  const keyword = params.q?.trim() ?? "";
  const activeVisibility = params.visibility ?? "ALL";
  const activeSort = params.sort ?? "sort";

  const where: Prisma.ContactDirectoryWhereInput = { villageId: membership.villageId };
  if (activeVisibility === "PUBLIC") {
    where.isPublic = true;
  } else if (activeVisibility === "RESIDENT_ONLY") {
    where.isPublic = false;
  }
  if (keyword) {
    where.OR = [
      { name: { contains: keyword, mode: "insensitive" } },
      { role: { contains: keyword, mode: "insensitive" } },
      { phone: { contains: keyword, mode: "insensitive" } },
      { category: { contains: keyword, mode: "insensitive" } },
    ];
  }

  const orderBy =
    activeSort === "name"
      ? [{ name: "asc" as const }]
      : activeSort === "newest"
        ? [{ createdAt: "desc" as const }]
        : [{ sortOrder: "asc" as const }, { createdAt: "desc" as const }];

  const contacts = await prisma.contactDirectory.findMany({
    where,
    orderBy,
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

  const suggestionTitles = Array.from(new Set(contacts.map((contact) => contact.name))).slice(0, 12);

  function buildContactsHref(next: { q?: string; visibility?: string; sort?: string }) {
    const query = new URLSearchParams();
    const q = next.q?.trim() ?? "";
    const visibility = next.visibility ?? "ALL";
    const sort = next.sort ?? "sort";
    if (q) query.set("q", q);
    if (visibility !== "ALL") query.set("visibility", visibility);
    if (sort !== "sort") query.set("sort", sort);
    const queryString = query.toString();
    return queryString ? `/admin/contacts?${queryString}` : "/admin/contacts";
  }

  return (
    <div className="space-y-6">
      <AdminListToolbar
        title="รายชื่อผู้ติดต่อ"
        description="เพิ่ม แก้ไข และลบข้อมูลติดต่อหมู่บ้าน"
        searchAction="/admin/contacts"
        keyword={keyword}
        searchPlaceholder="ค้นหาชื่อ ตำแหน่ง เบอร์โทร หรือหมวดหมู่"
        hiddenInputs={{ visibility: activeVisibility === "ALL" ? "" : activeVisibility, sort: activeSort === "sort" ? "" : activeSort }}
        suggestionTitles={suggestionTitles}
        groups={[
          {
            label: "การมองเห็น",
            options: [
              { label: "ทั้งหมด", href: buildContactsHref({ q: keyword, visibility: "ALL", sort: activeSort }), active: activeVisibility === "ALL" },
              { label: "สาธารณะ", href: buildContactsHref({ q: keyword, visibility: "PUBLIC", sort: activeSort }), active: activeVisibility === "PUBLIC" },
              { label: "ลูกบ้าน", href: buildContactsHref({ q: keyword, visibility: "RESIDENT_ONLY", sort: activeSort }), active: activeVisibility === "RESIDENT_ONLY" },
            ],
          },
          {
            label: "เรียง",
            options: [
              { label: "ตามลำดับ", href: buildContactsHref({ q: keyword, visibility: activeVisibility, sort: "sort" }), active: activeSort === "sort" },
              { label: "ชื่อตาม ก-ฮ", href: buildContactsHref({ q: keyword, visibility: activeVisibility, sort: "name" }), active: activeSort === "name" },
              { label: "ล่าสุด", href: buildContactsHref({ q: keyword, visibility: activeVisibility, sort: "newest" }), active: activeSort === "newest" },
            ],
          },
        ]}
        actions={
          <Link href="/admin/contacts/new">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" /> เพิ่มผู้ติดต่อ
            </Button>
          </Link>
        }
      />

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
