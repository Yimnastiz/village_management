import { CalendarRequestForm } from "../request-form";

export default function ResidentCalendarRequestNewPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ขอเพิ่มกิจกรรมหมู่บ้าน</h1>
        <p className="mt-1 text-sm text-gray-500">คำขอจะถูกส่งให้แอดมินพิจารณาก่อนเผยแพร่ในปฏิทิน</p>
      </div>
      <CalendarRequestForm />
    </div>
  );
}
