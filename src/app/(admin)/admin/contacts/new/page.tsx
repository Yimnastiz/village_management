import { ContactForm } from "../contact-form";
import Link from "next/link";

export default function NewContactPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">เพิ่มผู้ติดต่อ</h1>
        <p className="text-sm text-gray-500 mt-1">บันทึกข้อมูลติดต่อของหมู่บ้าน</p>
        <Link href="/admin/contacts/requests" className="mt-2 inline-flex rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
          ดูคำขอผู้ติดต่อจากลูกบ้าน
        </Link>
      </div>
      <ContactForm mode="create" />
    </div>
  );
}
