import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies, isAdminUser } from "@/lib/access-control";
import { ContactForm } from "../../contact-form";

interface PageProps {
  params: Promise<{ contactId: string }>;
}

export default async function EditContactPage({ params }: PageProps) {
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
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">แก้ไขผู้ติดต่อ</h1>
        <p className="text-sm text-gray-500 mt-1">อัปเดตข้อมูลผู้ติดต่อหมู่บ้าน</p>
      </div>
      <ContactForm
        mode="edit"
        contactId={contact.id}
        defaultValues={{
          name: contact.name,
          role: contact.role || "",
          phone: contact.phone || "",
          email: contact.email || "",
          address: contact.address || "",
          category: contact.category || "",
          sortOrder: String(contact.sortOrder),
          isPublic: contact.isPublic ? "PUBLIC" : "RESIDENT",
        }}
      />
    </div>
  );
}
