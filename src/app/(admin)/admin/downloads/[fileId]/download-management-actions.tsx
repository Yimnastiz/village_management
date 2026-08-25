"use client";

import Link from "next/link";
import { useState } from "react";
import { Archive, Pencil, RotateCcw, Send, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { archiveDownloadAction, deleteDownloadAction, publishDownloadAction, restoreDownloadAction } from "../actions";

type Dialog = "publish" | "archive" | "restore" | "delete" | null;
export function DownloadManagementActions({ fileId, stage }: { fileId: string; stage: "DRAFT" | "PUBLISHED" | "ARCHIVED" }) {
  const router = useRouter(); const toast = useToast(); const [dialog, setDialog] = useState<Dialog>(null); const [pending, setPending] = useState(false);
  const run = async () => {
    if (!dialog) return;
    setPending(true);
    const result = dialog === "publish" ? await publishDownloadAction(fileId) : dialog === "archive" ? await archiveDownloadAction(fileId) : dialog === "restore" ? await restoreDownloadAction(fileId) : await deleteDownloadAction(fileId);
    setPending(false);
    if (!result.success) { toast.error("ดำเนินการไม่สำเร็จ", result.error); return; }
    const completed = dialog; setDialog(null);
    if (completed === "delete") { toast.success("ลบเอกสารเรียบร้อยแล้ว"); router.push("/admin/downloads"); }
    else { toast.success(completed === "publish" ? "เผยแพร่เอกสารเรียบร้อยแล้ว" : completed === "archive" ? "จัดเก็บเอกสารเรียบร้อยแล้ว" : "คืนเอกสารเป็นร่างเรียบร้อยแล้ว"); router.refresh(); }
  };
  const info = dialog === "publish" ? { title: "เผยแพร่เอกสารนี้?", description: "เอกสารจะพร้อมให้ผู้มีสิทธิ์ดาวน์โหลด และระบบจะแจ้งเตือนลูกบ้าน", label: "เผยแพร่" } : dialog === "archive" ? { title: "จัดเก็บเอกสาร?", description: "ลูกบ้านจะไม่เห็นเอกสารนี้จนกว่าจะเผยแพร่อีกครั้ง", label: "จัดเก็บ" } : dialog === "restore" ? { title: "คืนเอกสารเป็นร่าง?", description: "เอกสารจะไม่แสดงให้ลูกบ้านดาวน์โหลดจนกว่าจะเผยแพร่ใหม่", label: "คืนเป็นร่าง" } : { title: "ลบเอกสารนี้?", description: "ไฟล์แนบและข้อมูลเอกสารจะถูกลบ และไม่สามารถย้อนกลับได้", label: "ลบเอกสาร" };
  return <><div className="flex flex-wrap items-center justify-end gap-2"><Link href={`/admin/downloads/${fileId}/edit`} className="inline-flex min-h-9 items-center justify-center rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"><Pencil className="mr-1 h-4 w-4" />แก้ไข</Link>{stage === "DRAFT" ? <Button type="button" size="sm" onClick={() => setDialog("publish")}><Send className="mr-1 h-4 w-4" />เผยแพร่</Button> : null}{stage === "PUBLISHED" ? <Button type="button" size="sm" variant="outline" onClick={() => setDialog("archive")}><Archive className="mr-1 h-4 w-4" />จัดเก็บ</Button> : null}{stage === "ARCHIVED" ? <Button type="button" size="sm" variant="outline" onClick={() => setDialog("restore")}><RotateCcw className="mr-1 h-4 w-4" />คืนเป็นร่าง</Button> : null}<Button type="button" size="sm" variant="dangerOutline" onClick={() => setDialog("delete")}><Trash2 className="mr-1 h-4 w-4" />ลบ</Button></div><ConfirmDialog open={Boolean(dialog)} title={info.title} description={info.description} confirmLabel={info.label} tone={dialog === "delete" ? "danger" : "default"} pending={pending} onClose={() => !pending && setDialog(null)} onConfirm={() => { void run(); }} /></>;
}
