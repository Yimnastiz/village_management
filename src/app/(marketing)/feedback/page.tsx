"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { submitPublicFeedbackAction } from "./actions";

export default function FeedbackPage() {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">เสนอแนะ / ร้องเรียน</h1>
      <p className="text-gray-500 mb-8">ไม่จำเป็นต้องล็อกอิน สามารถส่งข้อเสนอแนะได้ทันที</p>
      {submitted ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
          <p className="text-green-700 font-semibold text-lg">ขอบคุณสำหรับข้อเสนอแนะ!</p>
          <p className="text-green-600 text-sm mt-2">เราจะนำไปพิจารณาปรับปรุงระบบต่อไป</p>
        </div>
      ) : (
        <form
          className="bg-white rounded-xl border border-gray-200 p-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            const formData = new FormData(e.currentTarget);
            startTransition(async () => {
              const result = await submitPublicFeedbackAction(formData);
              if (!result.success) {
                setError(result.error);
                return;
              }

              setSubmitted(true);
            });
          }}
        >
          <Input label="ชื่อ (ไม่บังคับ)" name="name" placeholder="ชื่อ-นามสกุล" />
          <Input label="อีเมล (ไม่บังคับ)" name="email" type="email" placeholder="example@email.com" />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ประเภท</label>
            <select name="category" className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" required>
              <option value="">-- เลือกประเภท --</option>
              <option value="suggestion">ข้อเสนอแนะ</option>
              <option value="complaint">ร้องเรียน</option>
              <option value="bug">รายงานข้อผิดพลาด</option>
              <option value="other">อื่นๆ</option>
            </select>
          </div>
          <Textarea label="รายละเอียด" name="detail" placeholder="กรุณาระบุรายละเอียด..." rows={6} />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="submit" className="w-full" isLoading={isPending}>ส่งข้อเสนอแนะ</Button>
        </form>
      )}
    </div>
  );
}
