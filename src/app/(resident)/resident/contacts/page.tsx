import { redirect } from "next/navigation";
import { PhoneCall } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SaveButton } from "@/components/ui/save-button";
import { prisma } from "@/lib/prisma";
import { getResidentVillageAccess, getSessionContextFromServerCookies } from "@/lib/access-control";
import { toggleSaveContactAction } from "@/app/(resident)/resident/saved/actions";
import { ResidentContactsToolbar } from "./resident-contacts-toolbar";

export const dynamic = "force-dynamic";

type ResidentContactsPageProps = {
  searchParams?: Promise<{ q?: string }>;
};

export default async function ResidentContactsPage({ searchParams }: ResidentContactsPageProps) {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");

  const membership = await getResidentVillageAccess(session);
  if (!membership) redirect("/resident/dashboard");

  const query = (searchParams ? await searchParams : {}) ?? {};
  const keyword = query.q?.trim() ?? "";

  const [contacts, savedContacts] = await Promise.all([
    prisma.contactDirectory.findMany({
      where: {
        villageId: membership.villageId,
        ...(!membership.hasResidentAccess ? { isPublic: true } : {}),
        ...(keyword
          ? {
              OR: [
                { name: { contains: keyword, mode: "insensitive" as const } },
                { phone: { contains: keyword, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.savedItem.findMany({
      where: { userId: session.id, contactId: { not: null } },
      select: { contactId: true },
    }),
  ]);

  const savedSet = new Set(savedContacts.map((s) => s.contactId));

  return (
    <div className="space-y-6">
      <ResidentContactsToolbar keyword={keyword} canSubmit={membership.hasResidentAccess} />

      {membership.hasResidentAccess ? <div className="flex flex-wrap items-center gap-2">
        <Link href="/resident/contacts/new" className="rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700">
          ส่งคำขอเพิ่มผู้ติดต่อ
        </Link>
        <Link href="/resident/contacts/requests" className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          ติดตามคำขอของฉัน
        </Link>
      </div> : null}

      {contacts.length === 0 ? (
        <EmptyState
          icon={PhoneCall}
          title="ยังไม่มีรายชื่อผู้ติดต่อ"
          description="แอดมินหมู่บ้านยังไม่ได้เพิ่มรายชื่อผู้ติดต่อ"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {contacts.map((contact) => (
            <article key={contact.id} className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-5 space-y-3">
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {contact.category && (
                      <Badge variant="outline" className="mb-1">{contact.category}</Badge>
                    )}
                    <h2 className="font-semibold text-gray-900">
                      <Link href={`/resident/contacts/${contact.id}`} className="hover:underline">
                        {contact.name}
                      </Link>
                    </h2>
                    {contact.role && <p className="text-sm text-gray-500">{contact.role}</p>}
                  </div>
                </div>

                <div className="space-y-1 text-sm text-gray-600">
                  {contact.phone && (
                    <p>
                      <span className="text-gray-400">โทร: </span>
                      <a href={`tel:${contact.phone}`} className="font-medium text-green-700 hover:underline">
                        {contact.phone}
                      </a>
                    </p>
                  )}
                  {contact.email && (
                    <p>
                      <span className="text-gray-400">อีเมล: </span>
                      <a href={`mailto:${contact.email}`} className="hover:underline">
                        {contact.email}
                      </a>
                    </p>
                  )}
                  {contact.address && (
                    <p>
                      <span className="text-gray-400">ที่อยู่: </span>
                      {contact.address}
                    </p>
                  )}
                </div>
              </div>

              {membership.hasResidentAccess ? <SaveButton
                itemId={contact.id}
                initialSaved={savedSet.has(contact.id)}
                toggleAction={toggleSaveContactAction}
                label="บันทึกผู้ติดต่อ"
                savedLabel="บันทึกแล้ว"
              /> : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
