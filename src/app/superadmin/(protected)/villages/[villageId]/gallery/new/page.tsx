import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SuperAdminPageHeaderRegistration } from "@/components/layout/superadmin-page-header-context";
import { SuperAdminAlbumForm } from "../superadmin-gallery-form";
export default async function NewGalleryAlbum({ params }: { params: Promise<{ villageId: string }> }) {
  const { villageId } = await params;
  return <div className="workspace-list-page -mt-4 sm:-mt-6"><SuperAdminPageHeaderRegistration priority={1} context={{ title: "เพิ่มอัลบั้ม", description: "สร้างอัลบั้มเพื่อรวบรวมรูปภาพของหมู่บ้าน" }} /><div className="mt-3 space-y-3"><Link href={`/superadmin/villages/${villageId}/gallery`} className="inline-flex min-h-9 items-center gap-1.5 px-1 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft className="h-4 w-4" aria-hidden="true" />กลับรายการแกลเลอรี</Link><SuperAdminAlbumForm villageId={villageId} /></div></div>;
}
