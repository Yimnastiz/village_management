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
  { value: "HOURS", label: "ชั่วโมง" },
  { value: "MINUTES", label: "นาที" },
];

export function BroadcastComposer({ action }: { action: (formData: FormData) => void | Promise<void> }) {
  const [expiryMode, setExpiryMode] = useState("ONE_DAY");
  return (
    <form action={action} className="mt-5 grid gap-4">
      <div>
        <h2 className="text-base font-semibold text-gray-900">สร้างประกาศใหม่</h2>
        <p className="mt-1 text-sm text-gray-500">ส่งข้อความถึงสมาชิกที่ใช้งานอยู่ในหมู่บ้าน</p>
      </div>
      <Input required name="title" label="หัวข้อประกาศ" />
      <Textarea required name="body" label="รายละเอียดประกาศ" rows={5} className="resize-y leading-6" />
      <Select required name="expiryMode" label="ระยะเวลาการแสดง" value={expiryMode} onChange={(event) => setExpiryMode(event.target.value)} options={expiryOptions} />
      {expiryMode === "CUSTOM" ? <div className="grid gap-3 sm:grid-cols-2">
        <Input required name="customValue" type="number" min="1" label="กำหนดเอง (จำนวน)" />
        <Select required name="customUnit" label="หน่วย" defaultValue="HOURS" options={unitOptions} />
      </div> : null}
      <div className="flex justify-end pt-1">
        <Button type="submit" className="min-h-10 w-full sm:w-auto">ส่งประกาศ</Button>
      </div>
    </form>
  );
}
