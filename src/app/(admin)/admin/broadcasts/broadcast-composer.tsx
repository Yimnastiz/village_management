"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const expiryOptions = [
  { value: "ONE_HOUR", label: "1 เธเธฑเนเธงเนเธกเธ" },
  { value: "ONE_DAY", label: "1 เธงเธฑเธ" },
  { value: "THREE_DAYS", label: "3 เธงเธฑเธ" },
  { value: "SEVEN_DAYS", label: "7 เธงเธฑเธ" },
  { value: "CUSTOM", label: "เธเธณเธซเธเธ”เน€เธญเธ" },
  { value: "NEVER", label: "เนเธกเนเธเธณเธซเธเธ”เธงเธฑเธเธซเธกเธ”เธญเธฒเธขเธธ" },
];

const unitOptions = [
  { value: "MINUTES", label: "เธเธฒเธ—เธต" },
  { value: "HOURS", label: "เธเธฑเนเธงเนเธกเธ" },
  { value: "DAYS", label: "เธงเธฑเธ" },
];

export function BroadcastComposer({ action, onCancel }: { action: (formData: FormData) => void | Promise<void>; onCancel?: () => void }) {
  const [expiryMode, setExpiryMode] = useState("ONE_DAY");
  return (
    <form action={action} className="grid gap-4">
      {/* The dialog owns the heading and description for this form. */}
      <Input required name="title" label="เธซเธฑเธงเธเนเธญเธเธฃเธฐเธเธฒเธจ" />
      <Textarea required name="body" label="เธฃเธฒเธขเธฅเธฐเน€เธญเธตเธขเธ”เธเธฃเธฐเธเธฒเธจ" rows={5} className="resize-y leading-6" />
      <Select required name="expiryMode" label="เธฃเธฐเธขเธฐเน€เธงเธฅเธฒเธเธฒเธฃเนเธชเธ”เธ" value={expiryMode} onChange={(event) => setExpiryMode(event.target.value)} options={expiryOptions} />
      {expiryMode === "CUSTOM" ? <div className="grid gap-3 sm:grid-cols-2">
        <Input required name="customValue" type="number" min="1" label="เธเธณเธซเธเธ”เน€เธญเธ (เธเธณเธเธงเธ)" />
        <Select required name="customUnit" label="เธซเธเนเธงเธข" defaultValue="HOURS" options={unitOptions} />
      </div> : null}
      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        {onCancel ? <Button type="button" variant="outline" className="min-h-10 w-full sm:w-auto" onClick={onCancel}>เธขเธเน€เธฅเธดเธ</Button> : null}
        <Button type="submit" className="min-h-10 w-full sm:w-auto">เธชเนเธเธเธฃเธฐเธเธฒเธจ</Button>
      </div>
    </form>
  );
}


