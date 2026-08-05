"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { proposeAppointmentTimeAction, rejectAppointmentAction, adminCancelAppointmentAction } from "@/app/(resident)/resident/appointments/actions";

export function ProposeTimeForm({ appointmentId, canReject = false }: { appointmentId: string; canReject?: boolean }) {
  const router = useRouter(); const [date, setDate] = useState(""); const [startTime, setStart] = useState(""); const [endTime, setEnd] = useState(""); const [message, setMessage] = useState(""); const [error, setError] = useState<string | null>(null); const [pending, setPending] = useState(false);
  return <form className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/40 p-4" onSubmit={async (event) => { event.preventDefault(); setPending(true); setError(null); const result = await proposeAppointmentTimeAction({ appointmentId, date, startTime, endTime, message }); if (!result.success) { setError(result.error); setPending(false); return; } setPending(false); router.refresh(); }}>
    <h2 className="font-semibold text-gray-900">เสนอวันเวลาให้ลูกบ้านยืนยัน</h2><div className="grid gap-3 sm:grid-cols-3"><Input label="วันที่" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /><Input label="เริ่มเวลา" type="time" value={startTime} onChange={(e) => setStart(e.target.value)} required /><Input label="สิ้นสุด" type="time" value={endTime} onChange={(e) => setEnd(e.target.value)} required /></div><Textarea label="ข้อความถึงลูกบ้าน" value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="เช่น รบกวนยืนยันเวลานี้" />{error ? <p className="text-sm text-red-600">{error}</p> : null}<Button type="submit" isLoading={pending}>เสนอวันเวลา</Button>
    {canReject ? <div className="border-t border-blue-200 pt-3"><Textarea label="เหตุผลที่ปฏิเสธคำขอ" value={message} onChange={(e) => setMessage(e.target.value)} rows={2} /><div className="mt-2 flex gap-2"><Button type="button" variant="danger" disabled={pending || message.trim().length < 5} onClick={async () => { setPending(true); const form = new FormData(); form.set("appointmentId", appointmentId); form.set("reviewNote", message); const result = await rejectAppointmentAction(form); if (!result.success) setError(result.error); setPending(false); if (result.success) router.refresh(); }}>ปฏิเสธคำขอ</Button><Button type="button" variant="outline" disabled={pending} onClick={async () => { const form = new FormData(); form.set("appointmentId", appointmentId); form.set("reason", message); const result = await adminCancelAppointmentAction(form); if (!result.success) setError(result.error); else router.push("/admin/appointments"); }}>ยกเลิกนัดหมาย</Button></div></div> : null}
  </form>;
}
