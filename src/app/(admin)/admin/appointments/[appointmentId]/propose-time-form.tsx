"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { proposeAppointmentTimeAction } from "@/app/(resident)/resident/appointments/actions";

export function ProposeTimeForm({ appointmentId }: { appointmentId: string }) {
  const router = useRouter(); const [date, setDate] = useState(""); const [startTime, setStart] = useState(""); const [endTime, setEnd] = useState(""); const [message, setMessage] = useState(""); const [error, setError] = useState<string | null>(null); const [pending, setPending] = useState(false);
  return <form className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/40 p-4" onSubmit={async (event) => { event.preventDefault(); setPending(true); setError(null); const result = await proposeAppointmentTimeAction({ appointmentId, date, startTime, endTime, message }); if (!result.success) { setError(result.error); setPending(false); return; } router.refresh(); }}>
    <h2 className="font-semibold text-gray-900">เสนอวันเวลาให้ลูกบ้านยืนยัน</h2><div className="grid gap-3 sm:grid-cols-3"><Input label="วันที่" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /><Input label="เริ่มเวลา" type="time" value={startTime} onChange={(e) => setStart(e.target.value)} required /><Input label="สิ้นสุด" type="time" value={endTime} onChange={(e) => setEnd(e.target.value)} required /></div><Textarea label="ข้อความถึงลูกบ้าน" value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="เช่น รบกวนยืนยันเวลานี้" />{error ? <p className="text-sm text-red-600">{error}</p> : null}<Button type="submit" isLoading={pending}>เสนอวันเวลา</Button>
  </form>;
}
