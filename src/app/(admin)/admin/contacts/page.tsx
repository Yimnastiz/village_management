import Link from "next/link";
import { ListChecks, PhoneCall } from "lucide-react";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { AdminListToolbar } from "@/components/ui/admin-list-toolbar";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { contactFilterCategories } from "@/lib/contact";
import { CONTACT_SORT_OPTIONS, parseContactSort, sortContactsByName } from "@/lib/contact-sort";
import { ContactCreateDialog } from "./contact-create-dialog";
import { ContactSortableList } from "./contact-sortable-list";

type PageProps = {
  searchParams?: Promise<{ q?: string; visibility?: string; category?: string; sort?: string }>;
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
  const activeCategory = params.category?.trim() ?? "";
  const activeSort = parseContactSort(params.sort);

  const where: Prisma.ContactDirectoryWhereInput = { villageId: membership.villageId };
  if (activeVisibility === "PUBLIC") {
    where.isPublic = true;
  } else if (activeVisibility === "RESIDENT_ONLY") {
    where.isPublic = false;
  }
  if (activeCategory) where.category = activeCategory;
  if (keyword) {
    where.OR = [
      { name: { contains: keyword, mode: "insensitive" } },
      { role: { contains: keyword, mode: "insensitive" } },
      { phone: { contains: keyword, mode: "insensitive" } },
      { email: { contains: keyword, mode: "insensitive" } },
      { address: { contains: keyword, mode: "insensitive" } },
      { category: { contains: keyword, mode: "insensitive" } },
    ];
  }

  const orderBy = activeSort === "newest"
    ? [{ createdAt: "desc" as const }, { id: "desc" as const }]
    : activeSort === "recommended"
      ? [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }, { id: "asc" as const }]
      : [{ id: "asc" as const }];

  const [contactRows, categoryRows, suggestionRows, pendingRequestCount] = await Promise.all([prisma.contactDirectory.findMany({
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
  }),
  prisma.contactDirectory.findMany({
    where: { villageId: membership.villageId, category: { not: null } },
    distinct: ["category"],
    select: { category: true },
    orderBy: { category: "asc" },
  }),
  prisma.contactDirectory.findMany({
    where: { villageId: membership.villageId },
    select: { name: true },
    orderBy: { name: "asc" },
    take: 20,
  }),
  prisma.contactRequest.count({
    where: { villageId: membership.villageId, status: "PENDING" },
  })]);

  const contacts = activeSort === "name_asc" ? sortContactsByName(contactRows, "asc") : activeSort === "name_desc" ? sortContactsByName(contactRows, "desc") : contactRows;
  const canReorder = activeSort === "recommended" && !keyword && !activeCategory && activeVisibility === "ALL";
  const suggestionTitles = Array.from(new Set(suggestionRows.map((contact) => contact.name))).slice(0, 12);
  const categories = contactFilterCategories(categoryRows.map((item) => item.category));

  function buildContactsHref(next: { q?: string; visibility?: string; category?: string; sort?: string }) {
    const query = new URLSearchParams();
    const q = next.q?.trim() ?? "";
    const visibility = next.visibility ?? "ALL";
    const category = next.category ?? "";
    const sort = parseContactSort(next.sort);
    if (q) query.set("q", q);
    if (visibility !== "ALL") query.set("visibility", visibility);
    if (category) query.set("category", category);
    if (sort !== "recommended") query.set("sort", sort);
    const queryString = query.toString();
    return queryString ? `/admin/contacts?${queryString}` : "/admin/contacts";
  }

  return (
    <div data-admin-compact-top className="space-y-3">
      <AdminListToolbar
        sticky
        compact
        title="รายชื่อผู้ติดต่อ"
        description="เพิ่ม แก้ไข และลบข้อมูลติดต่อหมู่บ้าน"
        searchAction="/admin/contacts"
        clearHref="/admin/contacts"
        keyword={keyword}
        searchPlaceholder="ค้นหาชื่อ ตำแหน่ง เบอร์โทร หรือหมวดหมู่"
        suggestionTitles={suggestionTitles}
        groups={[
          {
            label: "การมองเห็น",
            options: [
              { label: "ทั้งหมด", href: buildContactsHref({ q: keyword, visibility: "ALL", category: activeCategory, sort: activeSort }), active: activeVisibility === "ALL", isDefault: true },
              { label: "สาธารณะ", href: buildContactsHref({ q: keyword, visibility: "PUBLIC", category: activeCategory, sort: activeSort }), active: activeVisibility === "PUBLIC" },
              { label: "ลูกบ้าน", href: buildContactsHref({ q: keyword, visibility: "RESIDENT_ONLY", category: activeCategory, sort: activeSort }), active: activeVisibility === "RESIDENT_ONLY" },
            ],
          },
          ...(categories.length ? [{
            label: "หมวดหมู่",
            options: [
              { label: "ทั้งหมด", href: buildContactsHref({ q: keyword, visibility: activeVisibility, category: "", sort: activeSort }), active: !activeCategory, isDefault: true },
              ...categories.map((item) => ({ label: item, href: buildContactsHref({ q: keyword, visibility: activeVisibility, category: item, sort: activeSort }), active: activeCategory === item })),
            ],
          }] : []),
          {
            label: "เรียงลำดับ",
            options: CONTACT_SORT_OPTIONS.map((option) => ({ label: option.label, href: buildContactsHref({ q: keyword, visibility: activeVisibility, category: activeCategory, sort: option.value }), active: activeSort === option.value, isDefault: option.value === "recommended" })),
          },
        ]}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link href="/admin/contacts/requests">
              <Button size="sm" variant="outline" className="h-10 px-2 sm:px-3"><ListChecks className="h-4 w-4" /><span className="hidden sm:ml-1.5 sm:inline">คำขอจากลูกบ้าน</span>{pendingRequestCount > 0 ? <span aria-label={`คำขอรอพิจารณา ${pendingRequestCount} รายการ`} className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-xs font-semibold text-white">{pendingRequestCount}</span> : null}</Button>
            </Link>
            <ContactCreateDialog compact />
          </div>
        }
      />

      {activeSort === "recommended" ? <p className="px-1 text-xs text-gray-500">{canReorder ? "ลาก ⠿ เพื่อจัดลำดับ" : "ล้างการค้นหาและตัวกรองเพื่อจัดลำดับ"}</p> : null}

      {contacts.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
          <PhoneCall className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="font-medium text-gray-700">{keyword || activeVisibility !== "ALL" || activeCategory || activeSort !== "recommended" ? "ไม่พบผู้ติดต่อที่ตรงกับเงื่อนไข" : "ยังไม่มีข้อมูลผู้ติดต่อ"}</p>
          <p className="mt-1 text-sm text-gray-500">{keyword || activeVisibility !== "ALL" || activeCategory || activeSort !== "recommended" ? "ลองเปลี่ยนคำค้นหาหรือตัวกรอง" : "เพิ่มผู้ติดต่อเพื่อเริ่มต้นจัดการรายชื่อ"}</p>
          {!keyword && activeVisibility === "ALL" && !activeCategory && activeSort === "recommended" ? <div className="mt-4 inline-flex"><ContactCreateDialog /></div> : null}
        </div>
      ) : (
        <ContactSortableList contacts={contacts} enabled={canReorder} />
      )}
    </div>
  );
}
