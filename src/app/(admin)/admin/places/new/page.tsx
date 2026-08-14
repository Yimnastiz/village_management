import { PlaceForm } from "../place-form";
import { AdminPageToolbar } from "@/components/ui/admin-page-toolbar";

export default function AdminPlaceNewPage() {
  return (
    <div data-admin-compact-top className="mx-auto flex w-full max-w-3xl flex-col gap-3">
      <AdminPageToolbar variant="form" backHref="/admin/places" backLabel="กลับรายการสถานที่" backPlacement="header-end" title="เพิ่มสถานที่" description="เพิ่มข้อมูลวัด ร้านค้า และสถานที่จำเป็นของหมู่บ้าน" />
      <PlaceForm mode="create" />
    </div>
  );
}
