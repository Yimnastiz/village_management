"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AdminPageToolbar } from "@/components/ui/admin-page-toolbar";
import { SuperAdminPageHeaderRegistration } from "@/components/layout/superadmin-page-header-context";
import { useToast } from "@/components/ui/toast";
import { broadcastAnnouncementAction } from "./actions";

type BroadcastRow = { id: string; title: string; body: string; expiresAt: string | null; createdAtIso: string; audienceCount: number; createdByName: string | null; status: "ACTIVE" | "EXPIRED" | "ARCHIVED" };
type ExpiryMode = "ONE_HOUR" | "ONE_DAY" | "THREE_DAYS" | "SEVEN_DAYS" | "CUSTOM" | "NEVER";
const labels = { ACTIVE: "กำลังแสดง", EXPIRED: "หมดอายุแล้ว", ARCHIVED: "ยกเลิกแล้ว" } as const;
const variants = { ACTIVE: "success", EXPIRED: "warning", ARCHIVED: "default" } as const;

function formatDate(value: string) {
  return new Date(value).toLocaleString("th-TH");
}

export function BroadcastForm({ broadcasts, keyword, status, total }: { broadcasts: BroadcastRow[]; keyword: string; status: "all" | "active" | "expired" | "cancelled"; total: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { pushToast } = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [expiryMode, setExpiryMode] = useState<ExpiryMode>("ONE_DAY");
  const [customValue, setCustomValue] = useState("");
  const [customUnit, setCustomUnit] = useState<"MINUTES" | "HOURS">("HOURS");
  const [formOpen, setFormOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [draftData, setDraftData] = useState<FormData | null>(null);

  const reset = () => {
    setTitle("");
    setBody("");
    setExpiryMode("ONE_DAY");
    setCustomValue("");
    setCustomUnit("HOURS");
  };

  const closeForm = () => {
    setFormOpen(false);
    reset();
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (expiryMode === "CUSTOM" && (!/^\d+$/.test(customValue) || Number(customValue) < 1)) {
      pushToast({ tone: "error", title: "ระยะเวลาไม่ถูกต้อง", description: "กรุณาระบุจำนวนเต็มอย่างน้อย 1 นาที" });
      return;
    }
    setDraftData(new FormData(event.currentTarget));
    setConfirmOpen(true);
  };

  const confirm = async () => {
    if (!draftData) return;
    setPending(true);
    try {
      await broadcastAnnouncementAction(draftData);
      pushToast({ tone: "success", title: "ส่งประกาศแล้ว", description: "ระบบส่งประกาศให้ผู้ใช้ที่มีสมาชิกหมู่บ้านอยู่" });
      setConfirmOpen(false);
      closeForm();
      router.refresh();
    } catch (error) {
      pushToast({ tone: "error", title: "บันทึกประกาศไม่สำเร็จ", description: error instanceof Error ? error.message : "เกิดข้อผิดพลาด" });
    } finally {
      setPending(false);
    }
  };

  const changeStatus = (nextStatus: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextStatus === "all") params.delete("status");
    else params.set("status", nextStatus);
    params.delete("page");
    router.replace(params.size ? pathname + "?" + params : pathname, { scroll: false });
  };

  return (
    <div className="space-y-4">
      <SuperAdminPageHeaderRegistration context={{ title: "ประกาศส่วนกลาง", description: "ส่งและจัดการประกาศสำคัญที่ต้องการแจ้งให้ผู้ใช้งานทั่วทั้งระบบทราบ" }} />
      <AdminPageToolbar sticky compact hideHeading title="ประกาศส่วนกลาง" search={{ keyword, placeholder: "ค้นหาหัวข้อหรือเนื้อหา", label: "ค้นหาประกาศ" }} actions={<><label className="sr-only" htmlFor="broadcast-status">สถานะประกาศ</label><select id="broadcast-status" value={status} onChange={(event) => changeStatus(event.target.value)} className="min-h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-700"><option value="all">ทั้งหมด</option><option value="active">กำลังแสดง</option><option value="expired">หมดอายุแล้ว</option><option value="cancelled">ยกเลิกแล้ว</option></select><Button type="button" onClick={() => { reset(); setFormOpen(true); }} className="min-h-9 bg-cyan-600 hover:bg-cyan-700"><Plus className="mr-1.5 h-4 w-4" />สร้างประกาศ</Button></>} />
      <p className="text-sm text-slate-500">พบ {total.toLocaleString("th-TH")} ประกาศ</p>
      <section className="space-y-2" aria-label="ประวัติประกาศ">
        {broadcasts.length ? broadcasts.map((broadcast) => (
          <Link key={broadcast.id} href={"/superadmin/broadcasts/" + broadcast.id} className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-cyan-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2">
            <article className="min-w-0">
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><h2 className="min-w-0 break-words font-semibold text-slate-900">{broadcast.title}</h2><Badge variant={variants[broadcast.status]}>{labels[broadcast.status]}</Badge></div>
                  <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">{broadcast.body}</p>
                  <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500"><span>ผู้รับ {broadcast.audienceCount.toLocaleString("th-TH")} คน</span><span>สร้างเมื่อ {formatDate(broadcast.createdAtIso)}</span><span>{broadcast.expiresAt ? "หมดอายุ: " + formatDate(broadcast.expiresAt) : "ไม่กำหนดวันหมดอายุ"}</span></div>
                </div>
                <span className="shrink-0 text-sm font-medium text-cyan-700">ดูรายละเอียด <span aria-hidden="true">→</span></span>
              </div>
            </article>
          </Link>
        )) : <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">ยังไม่มีประวัติประกาศ</div>}
      </section>
      {formOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="broadcast-form-title">
          <form onSubmit={submit} className="max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4"><div><h2 id="broadcast-form-title" className="text-lg font-semibold text-slate-900">สร้างประกาศ</h2><p className="mt-1 text-sm text-slate-500">ส่งประกาศส่วนกลางถึงผู้รับตามสมาชิกหมู่บ้านที่ใช้งานอยู่</p></div><button type="button" onClick={closeForm} className="text-sm text-slate-500 hover:text-slate-900">ปิด</button></div>
            <div className="mt-5 space-y-4">
              <label className="block text-sm font-medium text-slate-700">หัวข้อ<input name="title" required value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
              <label className="block text-sm font-medium text-slate-700">เนื้อหา<textarea name="body" required rows={5} value={body} onChange={(event) => setBody(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
              <p className="text-sm leading-6 text-slate-500">ผู้ใช้งานที่มีสถานะสมาชิกหมู่บ้านที่ใช้งานอยู่จะได้รับประกาศเพียงหนึ่งครั้ง</p>
              <label className="block text-sm font-medium text-slate-700">ระยะเวลาประกาศ<select name="expiryMode" value={expiryMode} onChange={(event) => setExpiryMode(event.target.value as ExpiryMode)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="ONE_HOUR">1 ชั่วโมง</option><option value="ONE_DAY">1 วัน</option><option value="THREE_DAYS">3 วัน</option><option value="SEVEN_DAYS">7 วัน</option><option value="CUSTOM">กำหนดเอง</option><option value="NEVER">ไม่หมดอายุ</option></select></label>
              {expiryMode === "CUSTOM" ? <div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><label className="text-sm font-medium text-slate-700">จำนวน<input name="customValue" type="number" min="1" step="1" required value={customValue} onChange={(event) => setCustomValue(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label><label className="text-sm font-medium text-slate-700">หน่วย<select name="customUnit" aria-label="หน่วยระยะเวลา" value={customUnit} onChange={(event) => setCustomUnit(event.target.value as "MINUTES" | "HOURS")} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"><option value="MINUTES">นาที</option><option value="HOURS">ชั่วโมง</option></select></label></div> : null}
            </div>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={closeForm}>ยกเลิก</Button><Button type="submit">ส่งประกาศ</Button></div>
          </form>
        </div>
      ) : null}
      <ConfirmDialog open={confirmOpen} title="ยืนยันการส่งประกาศ" description="ประกาศนี้จะถูกส่งถึงผู้ใช้ที่มีสมาชิกหมู่บ้านทั้งหมด" confirmLabel="ส่งประกาศ" pending={pending} onClose={() => !pending && setConfirmOpen(false)} onConfirm={() => void confirm()} />
    </div>
  );
}

