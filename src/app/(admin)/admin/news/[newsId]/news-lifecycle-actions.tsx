"use client";

import { useState, useTransition } from "react";
import { Archive, RotateCcw, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ActionReasonDialog } from "@/components/admin/action-reason-dialog";
import { useToast } from "@/components/ui/toast";
import { adminChangeNewsStageAction } from "../actions";

export function NewsLifecycleActions({ newsId, stage }: { newsId: string; stage: "DRAFT" | "PUBLISHED" | "ARCHIVED" }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const next = stage === "PUBLISHED" ? "ARCHIVED" : "PUBLISHED";
  const label = stage === "DRAFT" ? "เผยแพร่" : stage === "PUBLISHED" ? "จัดเก็บ" : "นำกลับมาเผยแพร่";
  const description = stage === "PUBLISHED" ? "ข่าวจะถูกซ่อนจากผู้ใช้งานทั่วไป แต่ยังสามารถนำกลับมาเผยแพร่ได้" : stage === "ARCHIVED" ? "ยืนยันการนำข่าวกลับมาเผยแพร่" : "ยืนยันการเผยแพร่ข่าว";
  const successMessage = stage === "PUBLISHED" ? "จัดเก็บข่าวเรียบร้อยแล้ว" : stage === "ARCHIVED" ? "นำข่าวกลับมาเผยแพร่แล้ว" : "เผยแพร่ข่าวเรียบร้อยแล้ว";

  const run = (reason = "") => startTransition(async () => {
    const result = await adminChangeNewsStageAction(newsId, next, reason);
    if (!result.success) { toast.error(result.error); return; }
    toast.success(successMessage);
    setConfirming(false);
    router.refresh();
  });

  return <><Button size="sm" variant={stage === "PUBLISHED" ? "outline" : "primary"} disabled={pending} isLoading={pending} onClick={() => setConfirming(true)}>{stage === "PUBLISHED" ? <Archive className="mr-1 h-4 w-4" /> : stage === "ARCHIVED" ? <RotateCcw className="mr-1 h-4 w-4" /> : <Send className="mr-1 h-4 w-4" />}{label}</Button>{stage === "PUBLISHED" ? <ActionReasonDialog open={confirming} action="content.archive" title={`${label}ข่าว`} description="ข่าวจะถูกซ่อนจากผู้ใช้งาน และเหตุผลจะถูกบันทึกใน Audit Log" submitLabel={label} loading={pending} onCancel={() => setConfirming(false)} onSubmit={async (reason) => { run(reason); }} /> : <ConfirmDialog open={confirming} title={`${label}ข่าว`} description={description} confirmLabel={label} pending={pending} onClose={() => !pending && setConfirming(false)} onConfirm={() => run()} />}</>;
}
