"use client";

import { useId, useState } from "react";
import { ChevronDown, ChevronUp, Info } from "lucide-react";

export function ImportPreparationDisclosure() {
  const [isOpen, setIsOpen] = useState(false);
  const contentId = useId();

  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50/70">
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-100/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-green-600"
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={() => setIsOpen((open) => !open)}
      >
        <Info className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
        <span className="flex-1 text-sm font-semibold text-gray-900">ก่อนนำเข้าข้อมูล</span>
        {isOpen ? <ChevronUp className="h-4 w-4 text-gray-500" aria-hidden="true" /> : <ChevronDown className="h-4 w-4 text-gray-500" aria-hidden="true" />}
      </button>
      {isOpen && (
        <div id={contentId} className="border-t border-gray-200 px-4 py-3">
          <ul className="space-y-1 text-xs leading-5 text-gray-600 sm:text-sm">
            <li>ระบบจะตรวจสอบข้อมูลเดิมก่อนสร้างรายการใหม่ เพื่อลดข้อมูลซ้ำ</li>
            <li>การนำเข้าข้อมูลไม่ใช่การยืนยันตัวตนของลูกบ้าน</li>
            <li>ข้อมูลจะยังไม่ถูกบันทึกจริงจนกว่าจะตรวจสอบและยืนยัน</li>
          </ul>
        </div>
      )}
    </section>
  );
}
