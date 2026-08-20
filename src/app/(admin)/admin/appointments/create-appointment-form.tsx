"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { adminCreateAppointmentAction } from "@/app/(resident)/resident/appointments/actions";

type Resident = { id: string; name: string; phone: string; houseNumber: string };

export function CreateAppointmentForm({ onClose, onPendingChange }: { onClose: () => void; onPendingChange: (pending: boolean) => void }) {
  const router = useRouter();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Resident[]>([]);
  const [resident, setResident] = useState<Resident | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStart] = useState("");
  const [pending, setPending] = useState(false);
  const [residentError, setResidentError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => fetch(`/api/appointments/residents?q=${encodeURIComponent(q)}`).then((response) => response.ok ? response.json() : []).then(setItems).catch(() => setItems([])), 250);
    return () => clearTimeout(timer);
  }, [q]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!resident) {
      setResidentError("กรุณาเลือกลูกบ้าน");
      return;
    }
    if (pending) return;
    setPending(true);
    onPendingChange(true);
    try {
      const result = await adminCreateAppointmentAction({ residentUserId: resident.id, title, description, date, startTime });
      if (!result.success) {
        toast.error("สร้างนัดหมายไม่สำเร็จ", result.error);
        return;
      }
      toast.success("สร้างนัดหมายเรียบร้อยแล้ว");
      onPendingChange(false);
      onClose();
      router.refresh();
    } catch {
      toast.error("สร้างนัดหมายไม่สำเร็จ", "กรุณาลองใหม่อีกครั้ง");
    } finally {
      setPending(false);
      onPendingChange(false);
    }
  };

  return <form className="space-y-4" onSubmit={submit}>
    <div className="relative"><Input label="ลูกบ้าน" value={resident ? resident.name : q} onChange={(event) => { setResident(null); setResidentError(null); setQ(event.target.value); }} placeholder="ค้นหาชื่อ / เบอร์ / เลขบ้าน" error={residentError ?? undefined} required />{!resident && q ? <div className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border bg-white shadow-lg">{items.length ? items.map((item) => <button key={item.id} type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50" onClick={() => { setResident(item); setResidentError(null); setQ(""); }}>{item.name} · บ้าน {item.houseNumber || "-"} · {item.phone}</button>) : <p className="p-3 text-sm text-gray-500">ไม่พบลูกบ้าน</p>}</div> : null}</div>
    <Input label="เรื่องนัดหมาย" value={title} onChange={(event) => setTitle(event.target.value)} required minLength={3} />
    <Textarea label="รายละเอียด" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
    <div className="grid gap-4 sm:grid-cols-2"><Input label="วันที่" type="date" value={date} onChange={(event) => setDate(event.target.value)} required /><div><Input label="เวลา" type="time" value={startTime} onChange={(event) => setStart(event.target.value)} required step="1800" max="23:00" /><p className="mt-1 text-xs text-gray-500">ระบบกำหนดเวลานัดหมาย 30 นาที</p></div></div>
    <div className="flex flex-col-reverse gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:justify-end"><Button type="button" variant="outline" disabled={pending} onClick={onClose}>ยกเลิก</Button><Button type="submit" isLoading={pending} disabled={pending}>สร้างและเสนอวันเวลา</Button></div>
  </form>;
}
