"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { requestAppointmentAction } from "../actions";

type Recipient = { id: string; name: string; role: string; roleLabel?: string };

export default function NewAppointmentPage() {
  const router = useRouter();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [targetAdminUserId, setTargetAdminUserId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  useEffect(() => { fetch("/api/appointments/admin-recipients").then((r) => r.ok ? r.json() : []).then((items: Recipient[]) => setRecipients(items.filter((item) => Boolean(item.id)).filter((item, index, list) => list.findIndex((candidate) => candidate.id === item.id) === index))).catch(() => setRecipients([])); }, []);
  return <div className="mx-auto max-w-2xl space-y-5">
    <div><Link href="/resident/appointments" className="text-sm text-gray-500 hover:text-gray-800">← กลับไปรายการนัดหมาย</Link><h1 className="mt-3 text-2xl font-bold text-gray-900">ส่งคำขอนัดหมาย</h1><p className="mt-1 text-sm text-gray-600">ผู้ใหญ่บ้านจะตรวจสอบเรื่องและเสนอวันเวลาที่เหมาะสมกลับมาให้คุณยืนยัน</p></div>
    <form onSubmit={async (event) => { event.preventDefault(); setPending(true); setError(null); const result = await requestAppointmentAction({ title, description, preferredTime, targetAdminUserId: targetAdminUserId || undefined }); if (!result.success) { setError(result.error); setPending(false); return; } router.push(`/resident/appointments/${result.appointmentId}?success=1`); router.refresh(); }} className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 sm:p-6">
      <Input label="เรื่องที่ต้องการนัด" value={title} onChange={(event) => setTitle(event.target.value)} required minLength={3} />
      <Textarea label="รายละเอียด" value={description} onChange={(event) => setDescription(event.target.value)} rows={5} />
      {recipients.length > 0 ? <Select label="ผู้ที่ต้องการนัด" value={targetAdminUserId} onChange={(event) => setTargetAdminUserId(event.target.value)} placeholder="ให้ผู้ใหญ่บ้าน/เจ้าหน้าที่รับเรื่อง" options={recipients.map((item) => ({ value: item.id, label: `${item.name} (${item.roleLabel ?? item.role})` }))} /> : null}
      <Input label="ช่วงเวลาที่สะดวก (ไม่บังคับ)" value={preferredTime} onChange={(event) => setPreferredTime(event.target.value)} placeholder="เช่น วันธรรมดาช่วงเย็น" />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex flex-wrap gap-3"><Button type="submit" isLoading={pending}>ส่งคำขอนัดหมาย</Button><Link href="/resident/appointments"><Button type="button" variant="outline">ยกเลิก</Button></Link></div>
    </form>
  </div>;
}
