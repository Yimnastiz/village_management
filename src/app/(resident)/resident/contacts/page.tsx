import { redirect } from "next/navigation";
import { PhoneCall } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SaveButton } from "@/components/ui/save-button";
import { prisma } from "@/lib/prisma";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { toggleSaveContactAction } from "@/app/(resident)/resident/saved/actions";

export const dynamic = "force-dynamic";

export default async function ResidentContactsPage() {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");

  const membership = getResidentMembership(session);
  if (!membership) redirect("/auth/login");

  const [contacts, savedContacts] = await Promise.all([
    prisma.contactDirectory.findMany({
      where: { villageId: membership.villageId },
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">รายชื่อผู้ติดต่อ</h1>
        <p className="mt-1 text-sm text-gray-500">ช่องทางติดต่อหน่วยงานและผู้ประสานงานในหมู่บ้าน</p>
      </div>

      {contacts.length === 0 ? (
        <EmptyState
          icon={PhoneCall}
          title="ยังไม่มีรายชื่อผู้ติดต่อ"
          description="แอดมินหมู่บ้านยังไม่ได้เพิ่มรายชื่อผู้ติดต่อ"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {contacts.map((contact) => (
            <article
              key={contact.id}
              className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-5 space-y-3"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {contact.category && (
                      <Badge variant="outline" className="mb-1">{contact.category}</Badge>
                    )}
                    <h2 className="font-semibold text-gray-900">{contact.name}</h2>
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

              <SaveButton
                itemId={contact.id}
                initialSaved={savedSet.has(contact.id)}
                toggleAction={toggleSaveContactAction}
                label="บันทึกผู้ติดต่อ"
                savedLabel="บันทึกแล้ว"
              />
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
