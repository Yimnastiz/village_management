import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SuperAdminNewsForm } from "../superadmin-news-form";

export default async function SuperAdminNewNewsPage({ params }: { params: Promise<{ villageId: string }> }) {
  const { villageId } = await params;
  return <div className="mx-auto w-full max-w-3xl space-y-6 px-1 sm:px-0"><div className="flex items-center gap-3"><Link href={`/superadmin/villages/${villageId}/news`} className="text-gray-400 hover:text-gray-600"><ArrowLeft className="h-5 w-5" /></Link><h1 className="text-2xl font-bold text-gray-900">สร้างข่าวใหม่</h1></div><SuperAdminNewsForm villageId={villageId} mode="create" /></div>;
}
