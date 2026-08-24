import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ContactRequestType } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { getResidentVillageAccess, getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { ResidentContactRequestModal } from "../resident-contact-request-modal";

interface PageProps {
  params: Promise<{ contactId: string }>;
}

export default async function ResidentContactDetailPage({ params }: PageProps) {
  const { contactId } = await params;
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");

  const membership = await getResidentVillageAccess(session);
  if (!membership) redirect("/resident/dashboard");

  const contact = await prisma.contactDirectory.findFirst({
    where: { id: contactId, villageId: membership.villageId, ...(!membership.hasResidentAccess ? { isPublic: true } : {}) },
  });

  if (!contact) notFound();

  const [originRequest, pendingUpdate] = membership.hasResidentAccess ? await Promise.all([
    prisma.contactRequest.findFirst({ where: { villageId: membership.villageId, requesterId: session.id, type: ContactRequestType.CREATE, status: "APPROVED", approvedContactId: contact.id }, select: { id: true } }),
    prisma.contactRequest.findFirst({ where: { villageId: membership.villageId, requesterId: session.id, type: ContactRequestType.UPDATE, status: "PENDING", targetContactId: contact.id }, select: { id: true } }),
  ]) : [null, null];

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <Link href="/resident/contacts" className="text-sm text-gray-500 hover:text-gray-700">← กลับรายชื่อผู้ติดต่อ</Link>

      <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Badge variant={contact.isPublic ? "success" : "info"}>
            {contact.isPublic ? "สาธารณะ" : "เฉพาะลูกบ้าน"}
          </Badge>
          {contact.category ? <Badge variant="outline">{contact.category}</Badge> : null}
        </div>

        <h1 className="text-2xl font-bold text-gray-900">{contact.name}</h1>
        {contact.role ? <p className="text-gray-600">{contact.role}</p> : null}

        <div className="space-y-2 text-sm text-gray-700">
          <p>เบอร์โทร: {contact.phone ? <a href={`tel:${contact.phone}`} className="font-medium text-green-700 hover:underline">{contact.phone}</a> : "-"}</p>
          <p>อีเมล: {contact.email ? <a href={`mailto:${contact.email}`} className="font-medium text-blue-700 hover:underline">{contact.email}</a> : "-"}</p>
          <p>ที่อยู่: {contact.address || "-"}</p>
        </div>
        {originRequest ? <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">{pendingUpdate ? <Link href={`/resident/contacts/requests/${pendingUpdate.id}`} className="inline-flex min-h-10 items-center rounded-lg border border-amber-300 px-3 text-sm font-medium text-amber-800 hover:bg-amber-50">คำขอแก้ไขรอพิจารณา</Link> : <ResidentContactRequestModal mode="update-contact" contactId={contact.id} initialValues={{ name: contact.name, role: contact.role, phone: contact.phone ?? "", email: contact.email, address: contact.address, category: contact.category }} fullLabel />}</div> : null}
      </div>
    </div>
  );
}
