import { ContactForm } from "../contact-form";

export default function NewContactPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">เพิ่มผู้ติดต่อ</h1>
        <p className="text-sm text-gray-500 mt-1">บันทึกข้อมูลติดต่อของหมู่บ้าน</p>
      </div>
      <ContactForm mode="create" />
    </div>
  );
}
