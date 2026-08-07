"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SuggestCombobox } from "@/components/ui/suggest-combobox";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { submitPublicFeedbackAction } from "./actions";

const feedbackCategoryOptions = [
  { value: "ข้อเสนอแนะ", label: "ข้อเสนอแนะ", category: "suggestion" },
  { value: "ร้องเรียน", label: "ร้องเรียน", category: "complaint" },
  { value: "รายงานข้อผิดพลาด", label: "รายงานข้อผิดพลาด", category: "bug" },
  { value: "อื่นๆ", label: "อื่นๆ", category: "other" },
];

export default function FeedbackPage() {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryLabel, setCategoryLabel] = useState("");
  const [categoryValue, setCategoryValue] = useState("");
  const [isPending, startTransition] = useTransition();
  const { success, error: showError } = useToast();
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
              try {
                const result = await submitPublicFeedbackAction(formData);
                if (!result.success) {
                  setError(result.error);
                  return;
                }

                setSubmitted(true);
                success("ส่งข้อเสนอแนะแล้ว", "ขอบคุณที่ช่วยให้เราปรับปรุงระบบ");
              } catch (cause) {
                console.error("Unable to submit public feedback", cause);
                setError("ไม่สามารถส่งข้อเสนอแนะได้ กรุณาลองใหม่อีกครั้ง");
                showError("ส่งข้อเสนอแนะไม่สำเร็จ", "กรุณาลองใหม่อีกครั้ง");
              }
            });
          }}
        >
          <Input label="ชื่อ (ไม่บังคับ)" name="name" placeholder="ชื่อ-นามสกุล" />
          <Input label="อีเมล (ไม่บังคับ)" name="email" type="email" placeholder="example@email.com" />
          <input type="hidden" name="category" value={categoryValue} />
          <SuggestCombobox
            id="feedback-category"
            name="feedback-category-search-query"
            label="ประเภท"
            value={categoryLabel}
            options={feedbackCategoryOptions}
            placeholder="เลือกประเภท"
            emptyMessage="ไม่พบประเภทที่ตรงกัน"
            autoComplete="new-password"
            onChange={(nextValue) => {
              const selectedCategory = feedbackCategoryOptions.find((option) => option.value === nextValue);
              setCategoryLabel(nextValue);
              setCategoryValue(selectedCategory?.category ?? "");
              setError(null);
            }}
          />
          <Textarea label="รายละเอียด" name="detail" placeholder="กรุณาระบุรายละเอียด..." rows={6} />
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="submit" className="w-full" isLoading={isPending}>ส่งข้อเสนอแนะ</Button>
        </form>
      )}
    </div>
  );
}
