"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

type ExportDownloadProps = { href: string; requireConfirmation?: boolean };

export function ExportDownload({ href, requireConfirmation = true }: ExportDownloadProps) {
  const [pending, setPending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const toast = useToast();
  const closeDialog = () => { if (!pending) setConfirmOpen(false); };
  const download = async () => {
    if (pending) return;
    setPending(true);
    try {
      const response = await fetch(href);
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `population-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success("เตรียมข้อมูลส่งออกสำเร็จ");
      setConfirmOpen(false);
    } catch {
      toast.error("ส่งออกไม่สำเร็จ", "กรุณาลองใหม่อีกครั้ง");
    } finally {
      setPending(false);
    }
  };

  return <>
    <Button type="button" isLoading={pending} onClick={() => requireConfirmation ? setConfirmOpen(true) : void download()}>
      <Download className="mr-1 h-4 w-4" /> ดาวน์โหลด Excel
    </Button>
    <Dialog open={confirmOpen} onClose={closeDialog} closeOnBackdrop={false} title="ส่งออกข้อมูลประชากร" description="ไฟล์นี้มีข้อมูลส่วนบุคคล เช่น เลขบัตรประชาชน เบอร์โทรศัพท์ และอีเมล กรุณาจัดเก็บและใช้งานไฟล์อย่างเหมาะสม" footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" disabled={pending} onClick={closeDialog}>ยกเลิก</Button><Button type="button" isLoading={pending} onClick={download}>ยืนยันส่งออกข้อมูล</Button></div>}>
      <p className="text-sm leading-5 text-slate-600">ระบบจะเริ่มเตรียมไฟล์หลังจากยืนยันเท่านั้น</p>
    </Dialog>
  </>;
}
