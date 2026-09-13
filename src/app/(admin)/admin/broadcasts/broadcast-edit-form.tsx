"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function BroadcastEditForm({ action, broadcastId, title, body, onCancel }: { action: (formData: FormData) => void | Promise<void>; broadcastId: string; title: string; body: string; onCancel?: () => void }) {
  return <form action={action} className="grid gap-4"><input type="hidden" name="broadcastGroupId" value={broadcastId} /><input type="hidden" name="expiryMode" value="PRESERVE" /><Input required name="title" label="หัวข้อประกาศ" defaultValue={title} /><Textarea required name="body" label="รายละเอียดประกาศ" rows={5} defaultValue={body} className="resize-y leading-6" /><div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">{onCancel ? <Button type="button" variant="outline" className="min-h-10 w-full sm:w-auto" onClick={onCancel}>ยกเลิก</Button> : null}<Button type="submit" className="min-h-10 w-full sm:w-auto">บันทึกการแก้ไข</Button></div></form>;
}
