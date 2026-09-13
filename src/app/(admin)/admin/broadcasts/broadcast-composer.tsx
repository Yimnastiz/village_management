"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const expiryOptions = [
  { value: "ONE_HOUR", label: "1 ชั่วโมง" },
  { value: "ONE_DAY", label: "1 วัน" },
  { value: "THREE_DAYS", label: "3 วัน" },
  { value: "SEVEN_DAYS", label: "7 วัน" },
  { value: "CUSTOM", label: "กำหนดเอง" },
  { value: "NEVER", label: "ไม่กำหนดวันหมดอายุ" },
];

const unitOptions = [
  { value: "MINUTES", label: "นาที" },
  { value: "HOURS", label: "ชั่วโมง" },
  { value: "DAYS", label: "วัน" },
];

export function BroadcastComposer({ action, onCancel }: { action: (formData: FormData) => void | Promise<void>; onCancel?: () => void }) {
  const [expiryMode, setExpiryMode] = useState("ONE_DAY");
  return (
    <form action={action} className="grid gap-4">
      {/* The dialog owns the heading and description for this form. */}
      <Input required name="title" label="หัวข้อประกาศ" />
      <Textarea required name="body" label="รายละเอียดประกาศ" rows={5} className="resize-y leading-6" />
      <Select required name="expiryMode" label="ระยะเวลาการแสดง" value={expiryMode} onChange={(event) => setExpiryMode(event.target.value)} options={expiryOptions} />
      {expiryMode === "CUSTOM" ? <div className="grid gap-3 sm:grid-cols-2">
        <Input required name="customValue" type="number" min="1" label="กำหนดเอง (จำนวน)" />
        <Select required name="customUnit" label="หน่วย" defaultValue="HOURS" options={unitOptions} />
      </div> : null}
      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        {onCancel ? <Button type="button" variant="outline" className="min-h-10 w-full sm:w-auto" onClick={onCancel}>ยกเลิก</Button> : null}
        <Button type="submit" className="min-h-10 w-full sm:w-auto">ส่งประกาศ</Button>
      </div>
    </form>
  );
}

