import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { getContactProvenance } from "@/features/contact-provenance/server/provenance";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { ContactEditDialog } from "../contact-edit-dialog";
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
  const [provenance, pendingRequests] = await Promise.all([
    getContactProvenance(membership.villageId, contact.id),
    prisma.contactRequest.findMany({
      where: {
        villageId: membership.villageId,
        targetContactId: contact.id,
        status: "PENDING",
        type: { in: ["UPDATE", "DELETE"] },
      },
      select: { id: true, type: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const isResidentRequested = provenance.source === "RESIDENT_REQUESTED";
  const pendingUpdate = pendingRequests.find((request) => request.type === "UPDATE");
  const pendingDelete = pendingRequests.find((request) => request.type === "DELETE");

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">รายละเอียดผู้ติดต่อ</h1>
          <p className="text-sm text-gray-500 mt-1">ตรวจสอบหรือแก้ไขข้อมูลผู้ติดต่อ</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ContactEditDialog
            contactId={contact.id}
            residentRequested={isResidentRequested}
            defaultValues={{
              name: contact.name,
              role: contact.role || "",
              phone: contact.phone || "",
              email: contact.email || "",
              address: contact.address || "",
              category: contact.category || "",
              isPublic: contact.isPublic,
            }}
          />
          <DeleteContactButton contactId={contact.id} />
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Badge variant={contact.isPublic ? "success" : "info"}>
            {contact.isPublic ? "สาธารณะ" : "เฉพาะลูกบ้าน"}
          </Badge>
          {contact.category && <Badge variant="outline">{contact.category}</Badge>}
        </div>
        <h2 className="text-xl font-semibold text-gray-900">{contact.name}</h2>
        <div className="space-y-1 text-sm text-gray-500">
          <p>แหล่งข้อมูล: {isResidentRequested ? "มาจากคำขอลูกบ้าน" : "เพิ่มโดยผู้ดูแล"}</p>
          {isResidentRequested ? <Link className="inline-flex text-green-700 hover:underline" href={`/admin/contacts/requests/${provenance.requestId}`}>ดูคำขอต้นทาง</Link> : null}
          {pendingUpdate ? <Link className="block text-amber-700 hover:underline" href={`/admin/contacts/requests/${pendingUpdate.id}`}>มีคำขอแก้ไขรอพิจารณา</Link> : null}
          {pendingDelete ? <Link className="block text-amber-700 hover:underline" href={`/admin/contacts/requests/${pendingDelete.id}`}>มีคำขอลบรอพิจารณา</Link> : null}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">ตำแหน่ง</p>
            <p className="text-gray-900 mt-1">{contact.role || "ไม่ระบุ"}</p>
          </div>
          <div>
            <p className="text-gray-500">เบอร์โทร</p>
            <p className="mt-1 text-gray-900">{contact.phone ? <a href={`tel:${contact.phone}`} className="font-medium text-green-700 hover:underline">{contact.phone}</a> : "ไม่ระบุ"}</p>
          </div>
          <div>
            <p className="text-gray-500">อีเมล</p>
            <p className="mt-1 text-gray-900">{contact.email ? <a href={`mailto:${contact.email}`} className="font-medium text-blue-700 hover:underline">{contact.email}</a> : "ไม่ระบุ"}</p>
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
