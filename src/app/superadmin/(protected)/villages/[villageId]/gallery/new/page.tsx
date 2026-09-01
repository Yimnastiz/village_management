import { AdminPageToolbar } from "@/components/ui/admin-page-toolbar";
import { SuperAdminAlbumForm } from "../superadmin-gallery-form";
export default async function NewGalleryAlbum({ params }: { params: Promise<{ villageId: string }> }) { const { villageId } = await params; return <div className="space-y-3"><AdminPageToolbar sticky variant="form" backHref={`/superadmin/villages/${villageId}/gallery`} backLabel="กลับรายการแกลเลอรี" backPlacement="header-end" title="เพิ่มอัลบั้ม" description="สร้างอัลบั้มเพื่อรวบรวมรูปภาพของหมู่บ้าน" /><SuperAdminAlbumForm villageId={villageId} /></div>; }
