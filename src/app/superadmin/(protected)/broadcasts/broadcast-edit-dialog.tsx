"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { updateBroadcastAnnouncementAction } from "./actions";

type BroadcastForEdit = {
  id: string;
  title: string;
  body: string;
  expiresAt: string | null;
};

type ExpiryMode = "ONE_HOUR" | "ONE_DAY" | "THREE_DAYS" | "SEVEN_DAYS" | "CUSTOM" | "NEVER" | "PRESERVE";

export function BroadcastEditDialog({
  broadcast,
  open,
  onClose,
  onSuccess,
}: {
  broadcast: BroadcastForEdit;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const { pushToast } = useToast();
  const [title, setTitle] = useState(broadcast.title);
  const [body, setBody] = useState(broadcast.body);
  const [expiryMode, setExpiryMode] = useState<ExpiryMode>("PRESERVE");
  const [customValue, setCustomValue] = useState("");
  const [customUnit, setCustomUnit] = useState<"MINUTES" | "HOURS">("HOURS");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [draftData, setDraftData] = useState<FormData | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setTitle(broadcast.title);
    setBody(broadcast.body);
    setExpiryMode("PRESERVE");
    setCustomValue("");
  }, [broadcast.id, broadcast.title, broadcast.body, broadcast.expiresAt]);

  if (!open) return null;

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (expiryMode === "CUSTOM" && (!/^\d+$/.test(customValue) || Number(customValue) < 1)) {
      pushToast({ tone: "error", title: "ระยะเวลาไม่ถูกต้อง", description: "กรุณาระบุจำนวนเต็มอย่างน้อย 1 นาที" });
      return;
    }
    const data = new FormData(event.currentTarget);
    data.set("broadcastGroupId", broadcast.id);
    setDraftData(data);
    setConfirmOpen(true);
  };

  const confirm = async () => {
    if (!draftData) return;
    setPending(true);
    try {
      await updateBroadcastAnnouncementAction(draftData);
      pushToast({ tone: "success", title: "อัปเดตประกาศแล้ว", description: "การแก้ไขจะอัปเดตประกาศของผู้รับเดิมทั้งหมด" });
      setConfirmOpen(false);
      onClose();
      onSuccess?.();
    } catch (error) {
      pushToast({ tone: "error", title: "บันทึกประกาศไม่สำเร็จ", description: error instanceof Error ? error.message : "เกิดข้อผิดพลาด" });
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="broadcast-edit-title">
        <form onSubmit={submit} className="max-h-[calc(100dvh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="broadcast-edit-title" className="text-lg font-semibold text-slate-900">แก้ไขประกาศ</h2>
              <p className="mt-1 text-sm text-slate-500">การแก้ไขจะอัปเดตประกาศของผู้รับเดิมทั้งหมด</p>
            </div>
            <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-900">ปิด</button>
          </div>
          <div className="mt-5 space-y-4">
            <label className="block text-sm font-medium text-slate-700">หัวข้อ
              <input name="title" required value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="block text-sm font-medium text-slate-700">เนื้อหา
              <textarea name="body" required rows={6} value={body} onChange={(event) => setBody(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="block text-sm font-medium text-slate-700">ระยะเวลาประกาศ
              <select name="expiryMode" value={expiryMode} onChange={(event) => setExpiryMode(event.target.value as ExpiryMode)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="PRESERVE">คงวันหมดอายุเดิม</option>
                <option value="ONE_HOUR">1 ชั่วโมง</option>
                <option value="ONE_DAY">1 วัน</option>
                <option value="THREE_DAYS">3 วัน</option>
                <option value="SEVEN_DAYS">7 วัน</option>
                <option value="CUSTOM">กำหนดเอง</option>
                <option value="NEVER">ไม่หมดอายุ</option>
              </select>
            </label>
            {expiryMode === "CUSTOM" ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">จำนวน
                  <input name="customValue" type="number" min="1" step="1" required value={customValue} onChange={(event) => setCustomValue(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </label>
                <label className="text-sm font-medium text-slate-700">หน่วย
                  <select name="customUnit" aria-label="หน่วยระยะเวลา" value={customUnit} onChange={(event) => setCustomUnit(event.target.value as "MINUTES" | "HOURS")} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    <option value="MINUTES">นาที</option>
                    <option value="HOURS">ชั่วโมง</option>
                  </select>
                </label>
              </div>
            ) : null}
          </div>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
            <Button type="submit">บันทึกการแก้ไข</Button>
          </div>
        </form>
      </div>
      <ConfirmDialog open={confirmOpen} title="ยืนยันการแก้ไขประกาศ" description="การแก้ไขจะอัปเดตประกาศของผู้รับเดิมทั้งหมด" confirmLabel="บันทึกการแก้ไข" pending={pending} onClose={() => !pending && setConfirmOpen(false)} onConfirm={() => void confirm()} />
    </>
  );
}
