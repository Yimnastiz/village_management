"use client";

import { useActionState, useEffect, useState } from "react";
import { Check, Info, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { importPopulationWorkbookAction, type ImportActionState } from "./actions";
import { useToast } from "@/components/ui/toast";

export function PopulationImportForm({ targetVillageId, templateHref = "/api/admin/population/import-template", importAction = importPopulationWorkbookAction, showTemplateDownload = true }: { targetVillageId?: string; templateHref?: string; importAction?: typeof importPopulationWorkbookAction; showTemplateDownload?: boolean }) {
  const [selectedFile, setSelectedFile] = useState<{ name: string; size: number } | null>(null);
  const [state, formAction, isPending] = useActionState<ImportActionState | null, FormData>(
    importAction,
    null,
  );
  const toast = useToast();
  // The branches intentionally dispatch different toast side effects.
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  useEffect(() => { if (!state) return; state.success ? toast.success("ตรวจสอบไฟล์เรียบร้อยแล้ว กรุณาตรวจสอบข้อมูลก่อนยืนยัน", state.message) : toast.error("ไฟล์ไม่ถูกต้อง", state.message); }, [state, toast]);

  return (
    <div className="space-y-5">
      {/* 4-Step Workflow */}
      <ol className="grid overflow-hidden rounded-xl border border-gray-200 bg-white sm:grid-cols-2 lg:grid-cols-4">
        <li className="relative flex gap-3 p-4 lg:after:absolute lg:after:right-0 lg:after:top-6 lg:after:h-px lg:after:w-5 lg:after:translate-x-1/2 lg:after:bg-gray-200">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-600 text-xs font-semibold text-white">1</div>
          <div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">ดาวน์โหลดไฟล์ตัวอย่าง</h3>
              <p className="mt-1 text-xs leading-5 text-gray-500">ใช้ไฟล์ที่ระบบเตรียมไว้เพื่อให้รูปแบบข้อมูลถูกต้อง</p>
            </div>
          </div>
        </li>

        <li className="relative flex gap-3 border-t border-gray-200 p-4 sm:border-t-0 sm:border-l lg:after:absolute lg:after:right-0 lg:after:top-6 lg:after:h-px lg:after:w-5 lg:after:translate-x-1/2 lg:after:bg-gray-200">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-600 text-xs font-semibold text-white">2</div>
          <div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">กรอกข้อมูลใน Excel</h3>
              <p className="mt-1 text-xs leading-5 text-gray-500">กรอกข้อมูลบ้าน และรายชื่อประชากรเท่าที่มี</p>
            </div>
          </div>
        </li>

        <li className="relative flex gap-3 border-t border-gray-200 p-4 lg:border-l lg:border-t-0 lg:after:absolute lg:after:right-0 lg:after:top-6 lg:after:h-px lg:after:w-5 lg:after:translate-x-1/2 lg:after:bg-gray-200">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-600 text-xs font-semibold text-white">3</div>
          <div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">อัปโหลดเพื่อตรวจสอบ</h3>
              <p className="mt-1 text-xs leading-5 text-gray-500">ระบบจะแสดงสิ่งที่จะสร้าง อัปเดต หรือข้อมูลที่ขัดแย้ง</p>
            </div>
          </div>
        </li>

        <li className="flex gap-3 border-t border-gray-200 p-4 sm:border-l lg:border-t-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-600 text-xs font-semibold text-white">4</div>
          <div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">ตรวจสอบและยืนยัน</h3>
              <p className="mt-1 text-xs leading-5 text-gray-500">ข้อมูลจะยังไม่ถูกบันทึกจริงจนกว่าจะตรวจสอบและยืนยัน</p>
            </div>
          </div>
        </li>
      </ol>

      {/* Important Notes */}
      <section className="rounded-xl border border-gray-200 bg-gray-50/70 p-4" aria-labelledby="import-notes-heading">
        <div className="flex gap-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
          <div>
            <h2 id="import-notes-heading" className="text-sm font-semibold text-gray-900">ก่อนนำเข้าข้อมูล</h2>
            <ul className="mt-2 space-y-1 text-xs leading-5 text-gray-600">
              <li>ระบบจะตรวจสอบข้อมูลเดิมก่อนสร้างรายการใหม่ เพื่อลดข้อมูลซ้ำ</li>
              <li>การนำเข้าข้อมูลไม่ใช่การยืนยันตัวตนของลูกบ้าน</li>
              <li>ข้อมูลจะยังไม่ถูกบันทึกจริงจนกว่าจะตรวจสอบและยืนยัน</li>
            </ul>
          </div>
        </div>
      </section>

      {state && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            state.success
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          <p className="font-medium">{state.message}</p>
          {state.summary && (
            <p className="mt-1 text-xs opacity-90">
              ไฟล์ {state.summary.fileName} • ทั้งหมด {state.summary.totalRows} แถว • สำเร็จ {state.summary.importedRows} • ไม่สำเร็จ {state.summary.failedRows}
            </p>
          )}
          {state.errors && state.errors.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs">
              {state.errors.slice(0, 10).map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <form action={formAction} className="space-y-4 rounded-lg border border-gray-200 bg-white p-5">
        {targetVillageId ? <input type="hidden" name="targetVillageId" value={targetVillageId} /> : null}

        <div>
          <h3 className="mb-3 font-semibold text-gray-900">อัปโหลดไฟล์เพื่อตรวจสอบ</h3>
          <label
            htmlFor="population-import-file"
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-8 text-center transition-colors hover:border-green-500 hover:bg-green-50 focus-within:border-green-500 focus-within:ring-2 focus-within:ring-green-500/20"
          >
            <UploadCloud className="h-8 w-8 text-gray-400" />
            <p className="mt-3 text-sm font-medium text-gray-800">ลากไฟล์มาวาง หรือเลือกไฟล์จากเครื่อง</p>
            <p className="mt-1 text-xs text-gray-500">.xlsx, .xls, .csv · สูงสุด 10 MB</p>
            {selectedFile && (
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700">
                <Check className="h-3.5 w-3.5 text-green-600" aria-hidden="true" /> {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
              </div>
            )}
          </label>
          <input
            id="population-import-file"
            name="importFile"
            type="file"
            accept=".xlsx,.xls,.csv"
            required
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                setSelectedFile({ name: file.name, size: file.size });
              } else {
                setSelectedFile(null);
              }
            }}
          />
        </div>

        <p className="flex gap-2 text-xs leading-5 text-gray-500">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden="true" />
          ไฟล์ตัวอย่างตั้งค่าเลขที่บ้าน เบอร์โทรศัพท์ และเลขบัตรประชาชนเป็นรูปแบบข้อความไว้แล้ว เพื่อป้องกันเลข 0 ด้านหน้าหาย {showTemplateDownload ? "สำหรับไฟล์ CSV หรือไฟล์ที่สร้างเอง โปรดตั้งค่าคอลัมน์เหล่านี้เป็นข้อความ" : ""}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" isLoading={isPending}>
            ตรวจสอบไฟล์
          </Button>
          {showTemplateDownload ? <a href={templateHref} download className="inline-flex items-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">ดาวน์โหลดไฟล์ตัวอย่าง</a> : null}
        </div>
      </form>
    </div>
  );
}
