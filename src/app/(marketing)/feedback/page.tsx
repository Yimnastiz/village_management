"use client";
import { useEffect, useState, useTransition } from "react";
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
  { value: "อื่น ๆ", label: "อื่น ๆ", category: "other" },
];

export default function FeedbackPage() {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryLabel, setCategoryLabel] = useState("");
  const [categoryValue, setCategoryValue] = useState("");
  const [isPending, startTransition] = useTransition();
  const { success, error: showError } = useToast();
  useEffect(() => { void fetch("/api/system/public-feedback-availability").then((response) => response.json()).then((data: { enabled?: boolean }) => setAvailable(data.enabled === true)).catch(() => setAvailable(false)); }, []);
  if (available !== true) return <main className="mx-auto max-w-2xl px-4 py-12"><div className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><h1 className="text-xl font-semibold text-amber-950">ขณะนี้ยังไม่เปิดรับข้อมูล</h1><p className="mt-2 text-sm leading-6 text-amber-900">กรุณาลองใหม่อีกครั้งภายหลัง</p></div></main>;
  return <main className="mx-auto max-w-2xl px-4 py-12"><h1 className="mb-2 text-3xl font-bold text-gray-900">ข้อเสนอแนะ ร้องเรียน และรายงานปัญหาการใช้งาน</h1><p className="mb-3 text-gray-600">ใช้หน้านี้เพื่อส่งข้อเสนอแนะ คำร้องเรียน หรือรายงานปัญหาเกี่ยวกับเว็บไซต์และระบบได้ โดยไม่ต้องเข้าสู่ระบบ</p><p className="mb-8 text-sm text-gray-500">หากเป็นปัญหาหรือเรื่องที่เกิดขึ้นภายในหมู่บ้าน ให้สมาชิกเข้าสู่ระบบแล้วใช้เมนู “แจ้งปัญหา”</p>{submitted ? <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center"><p className="text-lg font-semibold text-green-700">ส่งข้อมูลเรียบร้อยแล้ว</p><p className="mt-2 text-sm text-green-600">ขอบคุณสำหรับข้อมูลที่จะช่วยให้เราปรับปรุงระบบ</p></div> : <form className="space-y-4 rounded-xl border border-gray-200 bg-white p-6" onSubmit={(event) => { event.preventDefault(); setError(null); const formData = new FormData(event.currentTarget); startTransition(async () => { try { const result = await submitPublicFeedbackAction(formData); if (!result.success) { setError(result.error); return; } setSubmitted(true); success("ส่งข้อมูลแล้ว", "ขอบคุณที่ช่วยให้เราปรับปรุงระบบ"); } catch (cause) { console.error("Unable to submit public feedback", cause); setError("ไม่สามารถส่งข้อมูลได้ กรุณาลองใหม่อีกครั้ง"); showError("ส่งข้อมูลไม่สำเร็จ", "กรุณาลองใหม่อีกครั้ง"); } }); }}><Input label="ชื่อ (ไม่บังคับ)" name="name" placeholder="ชื่อ-นามสกุล" /><Input label="อีเมล (ไม่บังคับ)" name="email" type="email" placeholder="example@email.com" /><input type="hidden" name="category" value={categoryValue} /><SuggestCombobox id="feedback-category" name="feedback-category-search-query" label="ประเภท" value={categoryLabel} options={feedbackCategoryOptions} placeholder="เลือกประเภท" emptyMessage="ไม่พบประเภทที่ตรงกัน" autoComplete="new-password" onChange={(nextValue) => { const selectedCategory = feedbackCategoryOptions.find((option) => option.value === nextValue); setCategoryLabel(nextValue); setCategoryValue(selectedCategory?.category ?? ""); setError(null); }} /><Textarea label="รายละเอียด" name="detail" placeholder="กรุณาระบุรายละเอียด..." rows={6} />{error ? <p className="text-sm text-red-600">{error}</p> : null}<Button type="submit" className="w-full" isLoading={isPending}>ส่งข้อมูล</Button></form>}</main>;
}
