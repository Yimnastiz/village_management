"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { BroadcastEditForm } from "./broadcast-edit-form";

export function BroadcastEditDialog({ action, broadcastId, title, body }: { action: (formData: FormData) => void | Promise<void>; broadcastId: string; title: string; body: string }) {
  const [open, setOpen] = useState(false);
  const submit = async (formData: FormData) => { await action(formData); setOpen(false); };
  return <><Button type="button" variant="outline" className="min-h-9" onClick={() => setOpen(true)}><Pencil className="mr-1.5 h-4 w-4" aria-hidden="true" />แก้ไข</Button><Dialog open={open} title="แก้ไขประกาศ" description="แก้ไขหัวข้อหรือรายละเอียดประกาศ" onClose={() => setOpen(false)}><BroadcastEditForm action={submit} onCancel={() => setOpen(false)} broadcastId={broadcastId} title={title} body={body} /></Dialog></>;
}
