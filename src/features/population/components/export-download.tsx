"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionReasonDialog } from "@/components/admin/action-reason-dialog";
import { useToast } from "@/components/ui/toast";

type ExportDownloadProps = { href: string; requireConfirmation?: boolean; reasonParam?: string };

export function ExportDownload({ href, requireConfirmation = true, reasonParam = "reason" }: ExportDownloadProps) {
  const [pending, setPending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const toast = useToast();
  const closeDialog = () => { if (!pending) setConfirmOpen(false); };
  const download = async (reason?: string) => {
    if (pending) return;
    setPending(true);
    try {
      const url = new URL(href, window.location.origin);
      if (reason) url.searchParams.set(reasonParam, reason);
      const response = await fetch(url);
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error ?? "ไม่สามารถส่งออกข้อมูลได้");
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `population-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      toast.success("เตรียมข้อมูลส่งออกสำเร็จ");
      setConfirmOpen(false);
    } catch (error) {
      toast.error("ส่งออกไม่สำเร็จ", error instanceof Error ? error.message : "กรุณาลองใหม่อีกครั้ง");
    } finally {
      setPending(false);
    }
  };

  return <>
    <Button type="button" isLoading={pending} onClick={() => requireConfirmation ? setConfirmOpen(true) : void download()}>
      <Download className="mr-1 h-4 w-4" /> ดาวน์โหลด Excel
    </Button>
    <ActionReasonDialog open={confirmOpen} action="population.export_sensitive" onCancel={closeDialog} loading={pending} onSubmit={download} title="ส่งออกข้อมูลประชากร" description="ไฟล์นี้มีข้อมูลส่วนบุคคล กรุณาระบุวัตถุประสงค์ในการส่งออกและจัดเก็บไฟล์อย่างเหมาะสม" submitLabel="ยืนยันส่งออกข้อมูล" />
  </>;
}
