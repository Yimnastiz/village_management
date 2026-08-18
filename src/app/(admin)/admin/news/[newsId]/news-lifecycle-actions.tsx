"use client";

import { useState, useTransition } from "react";
import { Archive, RotateCcw, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { adminChangeNewsStageAction } from "../actions";

export function NewsLifecycleActions({ newsId, stage }: { newsId: string; stage: "DRAFT" | "PUBLISHED" | "ARCHIVED" }) {
  const [pending, startTransition] = useTransition(); const [confirming, setConfirming] = useState(false); const router = useRouter(); const toast = useToast();
  const next = stage === "PUBLISHED" ? "ARCHIVED" : "PUBLISHED"; const label = stage === "DRAFT" ? "เผยแพร่" : stage === "PUBLISHED" ? "จัดเก็บ" : "นำกลับมาเผยแพร่";
  const run = () => startTransition(async () => { const result = await adminChangeNewsStageAction(newsId, next); if (!result.success) { toast.error(result.error); return; } toast.success(label === "จัดเก็บ" ? "จัดเก็บข่าวเรียบร้อย" : "อัปเดตสถานะข่าวเรียบร้อย"); setConfirming(false); router.refresh(); });
  return <>{<Button size="sm" variant={stage === "PUBLISHED" ? "outline" : "primary"} disabled={pending} isLoading={pending} onClick={() => setConfirming(true)}>{stage === "PUBLISHED" ? <Archive className="mr-1 h-4 w-4" /> : stage === "ARCHIVED" ? <RotateCcw className="mr-1 h-4 w-4" /> : <Send className="mr-1 h-4 w-4" />}{label}</Button>}{confirming ? <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true"><div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"><h2 className="text-lg font-semibold text-gray-900">{label}ข่าว</h2><p className="mt-2 text-sm text-gray-600">{stage === "PUBLISHED" ? "ข่าวจะถูกซ่อนจากผู้ใช้งานทั่วไป แต่ยังแก้ไขและนำกลับมาเผยแพร่ได้" : "ยืนยันการเปลี่ยนสถานะข่าว"}</p><div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="outline" disabled={pending} onClick={() => setConfirming(false)}>ยกเลิก</Button><Button isLoading={pending} onClick={run}>{label}</Button></div></div></div> : null}</>;
}
