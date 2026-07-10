"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import {
  broadcastAnnouncementAction,
  deleteBroadcastAnnouncementAction,
  updateBroadcastAnnouncementAction,
} from "./actions";

type BroadcastRow = {
  groupId: string;
  title: string;
  body: string;
  expiresAt: string | null;
  createdAtIso: string;
  audienceCount: number;
  active: boolean;
};

export function BroadcastForm({ broadcasts }: { broadcasts: BroadcastRow[] }) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string>("");
  const editingBroadcast = useMemo(
    () => broadcasts.find((item) => item.groupId === editingId) ?? null,
    [broadcasts, editingId]
  );

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [expiryMode, setExpiryMode] = useState<"NEVER" | "ONE_HOUR" | "ONE_DAY" | "CUSTOM">("ONE_DAY");
  const [customHours, setCustomHours] = useState("24");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [draftData, setDraftData] = useState<FormData | null>(null);

  const fillFromBroadcast = (groupId: string) => {
    const target = broadcasts.find((item) => item.groupId === groupId);
    if (!target) {
      return;
    }

    setMode("edit");
    setEditingId(groupId);
    setTitle(target.title);
    setBody(target.body);

    if (!target.expiresAt) {
      setExpiryMode("NEVER");
      setCustomHours("24");
      return;
    }

    const diffMs = new Date(target.expiresAt).getTime() - Date.now();
    const diffHours = Math.max(1, Math.round(diffMs / (60 * 60 * 1000)));
    if (diffHours <= 1) {
      setExpiryMode("ONE_HOUR");
      setCustomHours("1");
      return;
    }

    if (diffHours <= 24) {
      setExpiryMode("ONE_DAY");
      setCustomHours("24");
      return;
    }

    setExpiryMode("CUSTOM");
    setCustomHours(String(diffHours));
  };

  const resetForm = () => {
    setMode("create");
    setEditingId("");
    setTitle("");
    setBody("");
    setExpiryMode("ONE_DAY");
    setCustomHours("24");
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (mode === "edit") {
      formData.set("broadcastGroupId", editingId);
    }
    setDraftData(formData);
    setDialogOpen(true);
  };

  const handleConfirm = async () => {
    if (!draftData) {
      return;
    }

    setPending(true);
    try {
      if (mode === "create") {
        await broadcastAnnouncementAction(draftData);
        pushToast({ tone: "success", title: "ส่งประกาศทั่วระบบแล้ว", description: "ระบบได้กระจายประกาศไปยังทุกผู้ใช้ที่มีสมาชิกหมู่บ้าน" });
      } else {
        await updateBroadcastAnnouncementAction(draftData);
        pushToast({ tone: "success", title: "อัปเดตประกาศแล้ว", description: "ระบบได้ปรับเนื้อหาและเงื่อนไขประกาศเรียบร้อย" });
      }
      router.refresh();
      resetForm();
      setDialogOpen(false);
    } catch (error) {
      pushToast({ tone: "error", title: mode === "create" ? "ส่งประกาศไม่สำเร็จ" : "อัปเดตประกาศไม่สำเร็จ", description: error instanceof Error ? error.message : "เกิดข้อผิดพลาด" });
    } finally {
      setPending(false);
    }
  };

  const handleDelete = async (groupId: string) => {
    setPending(true);
    try {
      const formData = new FormData();
      formData.set("broadcastGroupId", groupId);
      await deleteBroadcastAnnouncementAction(formData);
      pushToast({ tone: "success", title: "ลบประกาศแล้ว", description: "ประกาศจะไม่แสดงในข่าวและการแจ้งเตือนอีก" });
      if (editingId === groupId) {
        resetForm();
      }
      router.refresh();
    } catch (error) {
      pushToast({ tone: "error", title: "ลบประกาศไม่สำเร็จ", description: error instanceof Error ? error.message : "เกิดข้อผิดพลาด" });
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="mt-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
            {mode === "create" ? "โหมดสร้างประกาศ" : "โหมดแก้ไขประกาศ"}
          </span>
          {mode === "edit" ? (
            <button
              type="button"
              className="text-xs font-semibold text-cyan-700 hover:underline"
              onClick={resetForm}
            >
              ยกเลิกการแก้ไข
            </button>
          ) : null}
        </div>

        <input
          name="title"
          placeholder="หัวข้อประกาศ"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          required
        />
        <textarea
          name="body"
          placeholder="เนื้อหาประกาศ"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={4}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          required
        />

        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <select
            name="expiryMode"
            value={expiryMode}
            onChange={(event) => setExpiryMode(event.target.value as "NEVER" | "ONE_HOUR" | "ONE_DAY" | "CUSTOM")}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="ONE_HOUR">หมดอายุใน 1 ชั่วโมง</option>
            <option value="ONE_DAY">หมดอายุใน 1 วัน</option>
            <option value="CUSTOM">กำหนดชั่วโมงเอง</option>
            <option value="NEVER">ไม่หมดอายุอัตโนมัติ</option>
          </select>
          <input
            name="customHours"
            type="number"
            min={1}
            step={1}
            value={customHours}
            onChange={(event) => setCustomHours(event.target.value)}
            disabled={expiryMode !== "CUSTOM"}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
            placeholder="จำนวนชั่วโมง"
          />
          <div className="flex gap-2">
            <Button type="submit" className="bg-cyan-600 hover:bg-cyan-700 focus:ring-cyan-500">
              {mode === "create" ? "ส่งประกาศทั่วระบบ" : "บันทึกการแก้ไขประกาศ"}
            </Button>
          </div>
        </div>
      </form>

      <div className="mt-6 space-y-2">
        <h3 className="text-sm font-semibold text-slate-900">ประกาศล่าสุดที่จัดการได้</h3>
        {broadcasts.length === 0 ? (
          <p className="text-sm text-slate-500">ยังไม่มีประวัติประกาศ</p>
        ) : (
          <div className="space-y-2">
            {broadcasts.map((broadcast) => (
              <div key={broadcast.groupId} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{broadcast.title}</p>
                    <p className="mt-0.5 text-xs text-slate-600 whitespace-pre-wrap">{broadcast.body}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      ผู้รับ {broadcast.audienceCount} ราย • สร้างเมื่อ {new Date(broadcast.createdAtIso).toLocaleString("th-TH")}
                    </p>
                    <p className="text-xs text-slate-500">
                      {broadcast.expiresAt ? `หมดอายุ: ${new Date(broadcast.expiresAt).toLocaleString("th-TH")}` : "ไม่หมดอายุอัตโนมัติ"}
                      {broadcast.active ? " • Active" : " • หมดอายุแล้ว"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => fillFromBroadcast(broadcast.groupId)}>
                      แก้ไข
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      onClick={() => {
                        setDialogOpen(true);
                        const formData = new FormData();
                        formData.set("broadcastGroupId", broadcast.groupId);
                        setDraftData(formData);
                      }}
                    >
                      ลบ
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={dialogOpen}
        title={draftData?.get("broadcastGroupId") ? "ยืนยันลบประกาศ" : mode === "create" ? "ยืนยันส่งประกาศทั่วระบบ" : "ยืนยันแก้ไขประกาศ"}
        description={
          draftData?.get("broadcastGroupId")
            ? "ประกาศนี้จะถูกยกเลิกการแสดงผลจากข่าวและการแจ้งเตือน"
            : mode === "create"
              ? "ประกาศนี้จะถูกส่งถึงผู้ใช้ที่มีสมาชิกหมู่บ้านทั้งหมดทันที"
              : "ระบบจะอัปเดตประกาศนี้กับผู้รับทุกคนทันที"
        }
        confirmLabel={draftData?.get("broadcastGroupId") ? "ลบประกาศ" : mode === "create" ? "ส่งประกาศ" : "บันทึกการแก้ไข"}
        tone={draftData?.get("broadcastGroupId") ? "danger" : "default"}
        pending={pending}
        onClose={() => !pending && setDialogOpen(false)}
        onConfirm={() => {
          if (draftData?.get("broadcastGroupId")) {
            void handleDelete(String(draftData.get("broadcastGroupId")));
            setDialogOpen(false);
            return;
          }
          void handleConfirm();
        }}
      />
    </>
  );
}
