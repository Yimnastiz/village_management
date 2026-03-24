import { AlbumForm } from "../album-form";

export default function NewGalleryAlbumPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">เพิ่มอัลบั้ม</h1>
        <p className="text-sm text-gray-500 mt-1">สร้างอัลบั้มเพื่อรวบรวมรูปภาพ พร้อมกำหนดวัน เดือน ปีของอัลบั้ม</p>
      </div>
      <AlbumForm mode="create" />
    </div>
  );
}
