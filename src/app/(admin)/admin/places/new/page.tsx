import { PlaceForm } from "../place-form";

export default function AdminPlaceNewPage() {
  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">เพิ่มสถานที่สำคัญ</h1>
        <p className="mt-1 text-sm text-gray-500">เพิ่มข้อมูลวัด ร้านค้า และสถานที่จำเป็นของหมู่บ้าน</p>
      </div>
      <PlaceForm mode="create" />
    </div>
  );
}
