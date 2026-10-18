import { PlaceForm } from "../place-form";
import { AdminPageToolbar } from "@/components/ui/admin-page-toolbar";

export default function AdminPlaceNewPage() {
  return (
    <div data-admin-compact-top className="space-y-3">
      <AdminPageToolbar variant="form" backHref="/admin/places" backLabel="กลับรายการสถานที่" backPlacement="header-start" title="เพิ่มสถานที่" description="เพิ่มข้อมูลวัด ร้านค้า และสถานที่จำเป็นของหมู่บ้าน" />
      <div className="mx-auto w-full max-w-3xl">
        <PlaceForm mode="create" />
      </div>
    </div>
  );
}
