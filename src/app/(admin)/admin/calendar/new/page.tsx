import { CalendarForm } from "../calendar-form";

export default function NewVillageEventPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">เพิ่มกิจกรรม</h1>
        <p className="text-sm text-gray-500 mt-1">บันทึกกิจกรรมลงปฏิทินของหมู่บ้าน</p>
      </div>
      <CalendarForm mode="create" />
    </div>
  );
}
