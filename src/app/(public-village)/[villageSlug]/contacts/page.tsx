import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { normalizeVillageSlugParam, getSlugVariants } from "@/lib/village-slug";

interface PageProps {
  params: Promise<{ villageSlug: string }>;
}

export default async function Page({ params }: PageProps) {
  const { villageSlug: rawVillageSlug } = await params;
  const villageSlug = normalizeVillageSlugParam(rawVillageSlug);

  const village = await prisma.village.findFirst({
    where: { slug: { in: getSlugVariants(villageSlug) } },
    select: { id: true, name: true },
  });
  if (!village) notFound();

  const contacts = await prisma.contactDirectory.findMany({
    where: { villageId: village.id, isPublic: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">รายชื่อผู้ติดต่อ</h1>
        <p className="text-sm text-gray-500 mt-1">ช่องทางติดต่อหน่วยงานและผู้ประสานงานของ {village.name}</p>
      </div>

      {contacts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-500">ยังไม่มีข้อมูลผู้ติดต่อสาธารณะ</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {contacts.map((contact) => (
            <article key={contact.id} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <div className="flex items-center gap-2">
                {contact.category && <Badge variant="outline">{contact.category}</Badge>}
                <Badge variant="outline">ลำดับ {contact.sortOrder}</Badge>
              </div>
              <h2 className="font-semibold text-gray-900">{contact.name}</h2>
              <p className="text-sm text-gray-600">{contact.role || "ไม่ระบุตำแหน่ง"}</p>
              <div className="text-sm text-gray-600 space-y-1">
                <p>โทร: {contact.phone || "ไม่ระบุ"}</p>
                <p>อีเมล: {contact.email || "ไม่ระบุ"}</p>
                <p>ที่อยู่: {contact.address || "ไม่ระบุ"}</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
