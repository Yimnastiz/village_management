"use client";

import { useState, useTransition } from "react";
import { Archive, RotateCcw, Send, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ActionReasonDialog } from "@/components/admin/action-reason-dialog";
import { useToast } from "@/components/ui/toast";
import { superAdminChangeNewsStageAction, superAdminDeleteNewsAction } from "./actions";

export function SuperAdminNewsActions({ villageId, newsId, stage }: { villageId: string; newsId: string; stage: "DRAFT" | "PUBLISHED" | "ARCHIVED" }) {
  const [pending, startTransition] = useTransition(); const [action, setAction] = useState<"stage" | "delete" | null>(null); const router = useRouter(); const toast = useToast();
  const next = stage === "PUBLISHED" ? "ARCHIVED" : "PUBLISHED";
  const stageLabel = stage === "DRAFT" ? "เผยแพร่" : stage === "PUBLISHED" ? "จัดเก็บ" : "นำกลับมาเผยแพร่";
  const run = (reason: string) => startTransition(async () => {
    const result = action === "delete" ? await superAdminDeleteNewsAction(villageId, newsId, reason) : await superAdminChangeNewsStageAction(villageId, newsId, next, reason);
    if (!result.success) { toast.error(result.error); return; }
    toast.success(action === "delete" ? "ลบข่าวเรียบร้อยแล้ว" : `${stageLabel}ข่าวเรียบร้อยแล้ว`);
    setAction(null); if (action === "delete") router.replace(`/superadmin/villages/${villageId}/news`); else router.refresh();
  });
  return <><Button size="sm" variant={stage === "PUBLISHED" ? "outline" : "primary"} disabled={pending} isLoading={pending} onClick={() => setAction("stage")}>{stage === "PUBLISHED" ? <Archive className="mr-1 h-4 w-4" /> : stage === "ARCHIVED" ? <RotateCcw className="mr-1 h-4 w-4" /> : <Send className="mr-1 h-4 w-4" />}{stageLabel}</Button><Button size="sm" variant="danger" disabled={pending} onClick={() => setAction("delete")}><Trash2 className="mr-1 h-4 w-4" />ลบ</Button><ActionReasonDialog open={action !== null} action="content.archive" title={action === "delete" ? "ยืนยันการลบข่าว" : `${stageLabel}ข่าว`} description="การดำเนินการนี้จะถูกบันทึกใน Audit Log และแจ้งผู้ดูแลหมู่บ้าน" submitLabel={action === "delete" ? "ลบข่าว" : stageLabel} reasonLabel="เหตุผลในการดำเนินการ" helperText="ระบุเหตุผลที่ผู้ดูแลระบบระดับสูงดำเนินการแทนผู้ดูแลหมู่บ้าน" requireReason minReasonLength={5} maxReasonLength={500} loading={pending} onCancel={() => setAction(null)} onSubmit={run} /></>;
}
