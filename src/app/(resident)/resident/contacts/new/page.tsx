"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ContactRequestForm } from "../contact-request-form";

export default function ResidentContactRequestNewPage() {
  const router = useRouter();

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/resident/contacts" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> กลับไปรายชื่อผู้ติดต่อ
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">ส่งคำขอเพิ่มผู้ติดต่อ</h1>
        <p className="mt-1 text-sm text-gray-500">ข้อมูลจะถูกส่งให้แอดมินตรวจสอบก่อนเผยแพร่</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <ContactRequestForm showActions onSuccess={(requestId) => router.push(`/resident/contacts/requests/${requestId}?submitted=1`)} onCancel={() => router.push("/resident/contacts")} />
      </div>
    </div>
  );
}
