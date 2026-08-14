import { AlbumForm } from "../album-form";
import { AdminPageToolbar } from "@/components/ui/admin-page-toolbar";

export default function NewGalleryAlbumPage() {
  return (
    <div data-admin-compact-top className="space-y-4">
      <AdminPageToolbar variant="form" backHref="/admin/gallery" backLabel="กลับรายการแกลเลอรี" backPlacement="header-end" title="เพิ่มอัลบั้ม" description="สร้างอัลบั้มเพื่อรวบรวมรูปภาพของหมู่บ้าน" />
      <AlbumForm mode="create" />
    </div>
  );
}
