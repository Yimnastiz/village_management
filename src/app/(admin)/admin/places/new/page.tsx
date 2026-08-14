import { PlaceForm } from "../place-form";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function AdminPlaceNewPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <Link href="/admin/places" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> กลับรายการสถานที่
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">เพิ่มสถานที่</h1>
        <p className="mt-1 text-sm text-gray-500">เพิ่มข้อมูลวัด ร้านค้า และสถานที่จำเป็นของหมู่บ้าน</p>
      </div>
      <PlaceForm mode="create" />
    </div>
  );
}
