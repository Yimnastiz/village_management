import { SuperAdminPageHeaderRegistration } from "@/components/layout/superadmin-page-header-context";
import { SuperAdminAlbumForm } from "../superadmin-gallery-form";

export default async function NewGalleryAlbum({ params }: { params: Promise<{ villageId: string }> }) {
  const { villageId } = await params;
  return <div className="workspace-list-page -mt-4 sm:-mt-6">
    <SuperAdminPageHeaderRegistration priority={1} context={{ title: "เพิ่มอัลบั้ม", description: "สร้างอัลบั้มเพื่อรวบรวมรูปภาพของหมู่บ้าน", backHref: `/superadmin/villages/${villageId}/gallery`, backLabel: "กลับรายการแกลเลอรี" }} />
    <div className="mt-3"><SuperAdminAlbumForm villageId={villageId} /></div>
  </div>;
}
