import { NewsRequestForm } from "../request-form";

export default function ResidentCreateNewsRequestPage() {
  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ส่งคำขอเพิ่มข่าว</h1>
        <p className="text-sm text-gray-500 mt-1">คำขอจะถูกส่งให้แอดมินอนุมัติก่อนเผยแพร่</p>
      </div>
      <NewsRequestForm mode="create" />
    </div>
  );
}
