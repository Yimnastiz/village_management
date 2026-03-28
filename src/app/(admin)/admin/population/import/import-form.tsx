"use client";

import { useActionState, useState } from "react";
import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { importPopulationWorkbookAction, type ImportActionState } from "./actions";

export function PopulationImportForm() {
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [state, formAction, isPending] = useActionState<ImportActionState | null, FormData>(
    importPopulationWorkbookAction,
    null,
  );

  return (
    <div className="space-y-4">
      {state && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
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

      <form action={formAction} className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
        <div>
          <label
            htmlFor="population-import-file"
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-8 text-center transition-colors hover:border-green-400 hover:bg-green-50"
          >
            <UploadCloud className="h-8 w-8 text-gray-400" />
            <p className="mt-3 text-sm font-medium text-gray-800">เลือกไฟล์ Excel หรือ CSV สำหรับนำเข้า</p>
            <p className="mt-1 text-xs text-gray-500">รองรับ .xlsx, .xls, .csv ขนาดไม่เกิน 10MB</p>
            {selectedFileName && <p className="mt-2 text-xs text-green-700">ไฟล์ที่เลือก: {selectedFileName}</p>}
          </label>
          <input
            id="population-import-file"
            name="importFile"
            type="file"
            accept=".xlsx,.xls,.csv"
            required
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setSelectedFileName(file?.name ?? null);
            }}
          />
        </div>

        <div className="rounded-lg bg-amber-50 px-4 py-3 text-xs text-amber-900">
          แนะนำให้ตั้งคอลัมน์ phone_number และ national_id ใน Excel เป็นชนิดข้อความ เพื่อไม่ให้เลขศูนย์ด้านหน้าหาย
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" isLoading={isPending}>
            นำเข้าข้อมูล
          </Button>
          <a
            href="/api/admin/population/import-template"
            className="inline-flex items-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            ดาวน์โหลด CSV Template
          </a>
        </div>
      </form>
    </div>
  );
}