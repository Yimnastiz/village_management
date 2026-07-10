"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createResidentContactRequestAction } from "../actions";

export default function ResidentContactRequestNewPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/resident/contacts" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> กลับไปรายชื่อผู้ติดต่อ
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">ส่งคำขอเพิ่มผู้ติดต่อ</h1>
        <p className="mt-1 text-sm text-gray-500">ข้อมูลจะถูกส่งให้แอดมินตรวจสอบก่อนเผยแพร่</p>
      </div>

      <form
        className="space-y-4 rounded-xl border border-gray-200 bg-white p-6"
        onSubmit={async (event) => {
          event.preventDefault();
          setError(null);
          setIsSubmitting(true);
          const result = await createResidentContactRequestAction(new FormData(event.currentTarget));
          setIsSubmitting(false);

          if (!result.success) {
            setError(result.error);
            return;
          }

          router.push(`/resident/contacts/requests/${result.requestId}?submitted=1`);
        }}
      >
        <Input name="name" label="ชื่อผู้ติดต่อ" required />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input name="phone" label="เบอร์โทร" required />
          <Input name="role" label="ตำแหน่ง/บทบาท" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input name="category" label="หมวดหมู่" placeholder="เช่น ฉุกเฉิน, หน่วยงาน" />
        </div>
        <Input name="address" label="ที่อยู่/รายละเอียดสถานที่" />
        <Textarea name="note" label="หมายเหตุเพิ่มเติม" rows={4} />

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex gap-3">
          <Button type="submit" isLoading={isSubmitting}>ส่งคำขอ</Button>
          <Link href="/resident/contacts">
            <Button type="button" variant="outline">ยกเลิก</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
