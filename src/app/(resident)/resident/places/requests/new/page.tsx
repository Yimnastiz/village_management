import { PlaceRequestForm } from "../request-form";

export default function ResidentPlaceRequestNewPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ขอเพิ่มสถานที่สำคัญ</h1>
        <p className="mt-1 text-sm text-gray-500">คำขอจะถูกส่งให้แอดมินพิจารณาก่อนเผยแพร่</p>
      </div>
      <PlaceRequestForm />
    </div>
  );
}
