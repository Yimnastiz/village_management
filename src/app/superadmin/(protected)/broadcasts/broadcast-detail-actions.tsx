"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdminPageToolbar } from "@/components/ui/admin-page-toolbar";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { archiveBroadcastAnnouncementAction } from "./actions";
import { BroadcastEditDialog } from "./broadcast-edit-dialog";

type BroadcastDetail = { id: string; title: string; body: string; expiresAt: string | null };

export function BroadcastDetailActions({ broadcast, canEdit }: { broadcast: BroadcastDetail; canEdit: boolean }) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const cancel = async () => {
    setPending(true);
    try {
      const data = new FormData();
      data.set("broadcastGroupId", broadcast.id);
      await archiveBroadcastAnnouncementAction(data);
      pushToast({ tone: "success", title: "ยกเลิกประกาศแล้ว", description: "ประกาศจะหยุดแสดงแก่ผู้รับ แต่ข้อมูลประวัติจะยังคงอยู่" });
      setCancelOpen(false);
      router.refresh();
    } catch (error) {
      pushToast({ tone: "error", title: "ยกเลิกประกาศไม่สำเร็จ", description: error instanceof Error ? error.message : "เกิดข้อผิดพลาด" });
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <AdminPageToolbar
        sticky
        compact
        hideHeading
        title={broadcast.title}
        variant="detail"
        actions={<div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-end"><Link href="/superadmin/broadcasts" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-slate-600 hover:bg-slate-50"><ArrowLeft className="h-4 w-4" aria-hidden="true" />กลับรายการประกาศ</Link>{canEdit ? <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => setEditOpen(true)}>แก้ไขประกาศ</Button><Button type="button" variant="danger" onClick={() => setCancelOpen(true)}>ยกเลิกประกาศ</Button></div> : null}</div>}
      />
      <BroadcastEditDialog broadcast={broadcast} open={editOpen} onClose={() => setEditOpen(false)} onSuccess={() => router.refresh()} />
      <ConfirmDialog open={cancelOpen} title="ยืนยันการยกเลิกประกาศ" description="ประกาศจะหยุดแสดงแก่ผู้รับ แต่ข้อมูลประวัติจะยังคงอยู่" confirmLabel="ยกเลิกประกาศ" tone="danger" pending={pending} onClose={() => !pending && setCancelOpen(false)} onConfirm={() => void cancel()} />
    </>
  );
}
