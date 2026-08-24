import { redirect } from "next/navigation";
import { MapPin, Mail, Phone, PhoneCall, Tag } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { SaveButton } from "@/components/ui/save-button";
import { prisma } from "@/lib/prisma";
import { getResidentVillageAccess, getSessionContextFromServerCookies } from "@/lib/access-control";
import { toggleSaveContactAction } from "@/features/saved/server/actions";
import { ResidentContactsToolbar } from "./resident-contacts-toolbar";

export const dynamic = "force-dynamic";

type ResidentContactsPageProps = {
  searchParams?: Promise<{ q?: string; category?: string; sort?: string }>;
};

export default async function ResidentContactsPage({ searchParams }: ResidentContactsPageProps) {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");

  const membership = await getResidentVillageAccess(session);
  if (!membership) redirect("/resident/dashboard");

  const query = (searchParams ? await searchParams : {}) ?? {};
  const keyword = query.q?.trim() ?? "";
  const category = query.category?.trim() ?? "";
  const sort = query.sort === "name" ? "name" : "default";

  const [contacts, categoryRows, savedContacts] = await Promise.all([
    prisma.contactDirectory.findMany({
      where: {
        villageId: membership.villageId,
        ...(!membership.hasResidentAccess ? { isPublic: true } : {}),
        ...(keyword
          ? {
              OR: [
                { name: { contains: keyword, mode: "insensitive" as const } },
                { phone: { contains: keyword, mode: "insensitive" as const } },
                { role: { contains: keyword, mode: "insensitive" as const } },
                { address: { contains: keyword, mode: "insensitive" as const } },
              ],
            }
          : {}),
        ...(category ? { category } : {}),
      },
      orderBy: sort === "name" ? [{ name: "asc" }] : [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.contactDirectory.findMany({
      where: { villageId: membership.villageId, ...(!membership.hasResidentAccess ? { isPublic: true } : {}), category: { not: null } },
      distinct: ["category"],
      select: { category: true },
      orderBy: { category: "asc" },
    }),
    prisma.savedItem.findMany({
      where: { userId: session.id, contactId: { not: null } },
      select: { contactId: true },
    }),
  ]);

  const savedSet = new Set(savedContacts.map((s) => s.contactId));

  return (
    <div className="space-y-4">
      <ResidentContactsToolbar keyword={keyword} category={category} sort={sort} categories={categoryRows.map((item) => item.category).filter((value): value is string => Boolean(value))} canSubmit={membership.hasResidentAccess} />

      {contacts.length === 0 ? (
        <EmptyState
          icon={PhoneCall}
          title={keyword || category || sort !== "default" ? "ไม่พบผู้ติดต่อที่ตรงกับเงื่อนไข" : "ยังไม่มีรายชื่อผู้ติดต่อ"}
          description={keyword || category || sort !== "default" ? "ลองเปลี่ยนคำค้นหาหรือตัวกรอง" : "แอดมินหมู่บ้านยังไม่ได้เพิ่มรายชื่อผู้ติดต่อ"}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
          {contacts.map((contact) => (
            <article key={contact.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-gray-900">
                      <Link href={`/resident/contacts/${contact.id}`} className="hover:underline">
                      {contact.name}
                      </Link>
                    </h2>
                    <p className={`mt-1 flex min-h-5 items-center gap-1.5 text-sm ${contact.category ? "text-gray-500" : "text-gray-400"}`}><Tag className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /><span className="min-w-0 break-words">{contact.category ?? "ไม่ระบุหมวดหมู่"}</span></p>
                    {contact.role && <p className="mt-1 text-sm text-gray-500">{contact.role}</p>}
                  </div>
                  {membership.hasResidentAccess ? <SaveButton itemId={contact.id} initialSaved={savedSet.has(contact.id)} toggleAction={toggleSaveContactAction} compact ariaLabel="บันทึกผู้ติดต่อ" savedAriaLabel="นำออกจากรายการบันทึก" /> : null}
                </div>

                <div className="space-y-1.5 text-sm text-gray-600">
                  {contact.phone && (
                    <p className="flex items-center gap-1.5">
                      <Phone className="h-4 w-4 shrink-0 text-green-700" aria-hidden="true" />
                      <a href={`tel:${contact.phone}`} className="font-medium text-green-700 hover:underline">
                        {contact.phone}
                      </a>
                    </p>
                  )}
                  {contact.email && (
                    <p className="flex min-w-0 items-center gap-1.5">
                      <Mail className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                      <a href={`mailto:${contact.email}`} className="truncate hover:underline">
                        {contact.email}
                      </a>
                    </p>
                  )}
                  {contact.address && (
                    <p className="flex items-start gap-1.5">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                      <span className="line-clamp-2">{contact.address}</span>
                    </p>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
