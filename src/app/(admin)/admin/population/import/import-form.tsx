"use client";

import { useActionState, useEffect, useState } from "react";
import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { importPopulationWorkbookAction, type ImportActionState } from "./actions";
import { useToast } from "@/components/ui/toast";

export function PopulationImportForm({ targetVillageId, templateHref = "/api/admin/population/import-template", importAction = importPopulationWorkbookAction }: { targetVillageId?: string; templateHref?: string; importAction?: typeof importPopulationWorkbookAction }) {
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
    <div className="space-y-6">
      {/* 4-Step Workflow */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">1</div>
            <div>
              <h3 className="font-semibold text-blue-900">ดาวน์โหลดไฟล์ตัวอย่าง</h3>
              <p className="mt-1 text-xs text-blue-800">ใช้ไฟล์ที่ระบบเตรียมไว้เพื่อให้รูปแบบข้อมูลถูกต้อง</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">2</div>
            <div>
              <h3 className="font-semibold text-blue-900">กรอกข้อมูลใน Excel</h3>
              <p className="mt-1 text-xs text-blue-800">กรอกข้อมูลบ้าน และรายชื่อประชากรเท่าที่มี</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">3</div>
            <div>
              <h3 className="font-semibold text-blue-900">อัปโหลดเพื่อตรวจสอบ</h3>
              <p className="mt-1 text-xs text-blue-800">ระบบจะตรวจสอบข้อมูลและแสดงสิ่งที่จะสร้าง อัปเดต หรือข้อมูลที่ขัดแย้ง</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">4</div>
            <div>
              <h3 className="font-semibold text-blue-900">ตรวจสอบและยืนยัน</h3>
              <p className="mt-1 text-xs text-blue-800">ข้อมูลจะยังไม่ถูกบันทึกจริงจนกว่าผู้ใหญ่บ้านจะตรวจสอบและยืนยัน</p>
            </div>
          </div>
        </div>
      </div>

      {/* Important Notes */}
      <div className="space-y-3">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">การนำเข้าข้อมูลไม่ใช่การยืนยันตัวตนของลูกบ้าน</p>
          <p className="mt-1 text-xs">ข้อมูลบ้านต้องมาจากทะเบียนหรือผู้ดูแล แถวที่มีปัญหาจะไม่ถูกนำเข้า และระบบจะไม่ลบบุคคลเดิมโดยอัตโนมัติ</p>
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <p className="font-medium">ระบบจะตรวจสอบข้อมูลเดิมก่อนสร้างรายการใหม่</p>
          <p className="mt-1 text-xs">เลขที่บ้าน ใช้หาบ้านเดิม • เลขบัตรประชาชน/เบอร์โทรศัพท์ ช่วยค้นหาบุคคลเดิม เพื่อลดข้อมูลซ้ำ</p>
        </div>
      </div>

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
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-8 text-center transition-colors hover:border-blue-400 hover:bg-blue-50"
          >
            <UploadCloud className="h-8 w-8 text-gray-400" />
            <p className="mt-3 text-sm font-medium text-gray-800">ลากไฟล์มาวาง หรือเลือกไฟล์จากเครื่อง</p>
            <p className="mt-1 text-xs text-gray-500">.xlsx, .xls, .csv · สูงสุด 10 MB</p>
            {selectedFile && (
              <div className="mt-2 rounded-lg bg-green-100 px-3 py-2 text-xs text-green-800">
                ✓ {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
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

        <div className="rounded-lg bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <p className="font-medium">เพื่อป้องกันเลข 0 ด้านหน้าหาย ควรตั้งคอลัมน์ "เบอร์โทรศัพท์" และ "เลขบัตรประชาชน" เป็นรูปแบบข้อความ (Text) ใน Excel</p>
          <p className="mt-1">เลขที่บ้าน เช่น 99/12 ต้องเป็นข้อความ เพื่อไม่ให้ถูกแปลงเป็นวันที่</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" isLoading={isPending}>
            ตรวจสอบไฟล์
          </Button>
          <a
            href={templateHref}
            download
            className="inline-flex items-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            ดาวน์โหลดไฟล์ตัวอย่าง
          </a>
        </div>
      </form>
    </div>
  );
}
