"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { BroadcastComposer } from "./broadcast-composer";

export function BroadcastCreateDialog({ action }: { action: (formData: FormData) => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  const submit = async (formData: FormData) => { await action(formData); setOpen(false); };
  return <><Button type="button" className="min-h-9 shrink-0" onClick={() => setOpen(true)}><Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />สร้างประกาศ</Button><Dialog open={open} title="สร้างประกาศ" description="ส่งข้อความถึงสมาชิกในหมู่บ้าน" onClose={() => setOpen(false)}><BroadcastComposer action={submit} onCancel={() => setOpen(false)} /></Dialog></>;
}
