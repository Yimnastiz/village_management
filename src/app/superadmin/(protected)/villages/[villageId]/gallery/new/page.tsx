import { AdminPageToolbar } from "@/components/ui/admin-page-toolbar";
import { SuperAdminPageHeaderRegistration } from "@/components/layout/superadmin-page-header-context";
import { SuperAdminAlbumForm } from "../superadmin-gallery-form";

export default async function NewGalleryAlbum({ params }: { params: Promise<{ villageId: string }> }) {
  const { villageId } = await params;
  return <div className="workspace-list-page -mt-4 sm:-mt-6">
    <SuperAdminPageHeaderRegistration priority={1} context={{ title: "เพิ่มอัลบั้ม", description: "สร้างอัลบั้มเพื่อรวบรวมรูปภาพของหมู่บ้าน" }} />
    <AdminPageToolbar sticky hideHeading variant="form" backHref={`/superadmin/villages/${villageId}/gallery`} backLabel="กลับรายการแกลเลอรี" backPlacement="header-end" title="เพิ่มอัลบั้ม" description="สร้างอัลบั้มเพื่อรวบรวมรูปภาพของหมู่บ้าน" />
    <div className="mt-4"><SuperAdminAlbumForm villageId={villageId} /></div>
  </div>;
}

