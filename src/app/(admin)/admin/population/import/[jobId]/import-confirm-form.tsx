"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionReasonDialog } from "@/components/admin/action-reason-dialog";
import { useToast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";
import { confirmPopulationImportAction, deleteImportJobDatasetAction, type ImportCleanupPreflight } from "./actions";

type ImportJobActionsProps = { jobId: string; createdRows: number; updatedRows: number; conflictRows: number; failedRows: number; cleanupPeopleCount: number; cleanupHousesCount: number; cleanupPreflight?: ImportCleanupPreflight | null; canConfirm: boolean; canCleanup: boolean; targetVillageId?: string; fileName?: string };

export function ImportJobActions({ jobId, createdRows, updatedRows, conflictRows, failedRows, cleanupPeopleCount, cleanupHousesCount, cleanupPreflight, canConfirm, canCleanup, targetVillageId, fileName }: ImportJobActionsProps) {
  const router = useRouter(); const toast = useToast();
  const [dialog, setDialog] = useState<"confirm" | "cleanup" | null>(null);
  const [isPending, startTransition] = useTransition();
  const close = () => { if (!isPending) setDialog(null); };
  const submitConfirm = (reason: string) => {
    startTransition(async () => { try { const formData = new FormData(); formData.set("jobId", jobId); formData.set("supportReason", reason); if (targetVillageId) formData.set("targetVillageId", targetVillageId); const result = await confirmPopulationImportAction(formData); setDialog(null); toast.success("นำเข้าข้อมูลเรียบร้อย", `นำเข้า ${result.importedRows.toLocaleString("th-TH")} รายการ · ข้าม ${result.skippedRows.toLocaleString("th-TH")} · ไม่สำเร็จ ${result.failedRows.toLocaleString("th-TH")}`); router.refresh(); } catch (error) { toast.error("นำเข้าข้อมูลไม่สำเร็จ", error instanceof Error ? error.message : "กรุณาลองใหม่อีกครั้ง"); } });
  };
  const submitCleanup = (reason: string) => {
    startTransition(async () => { try {
      const formData = new FormData(); formData.set("jobId", jobId); formData.set("supportReason", reason); if (targetVillageId) formData.set("targetVillageId", targetVillageId);
      const result = await deleteImportJobDatasetAction(formData);
      setDialog(null);
      const deleted = result.deletedPeople + result.deletedHouses;
      if (result.skippedCount > 0) toast.success("ลบข้อมูลได้บางส่วน", `ลบ ${deleted.toLocaleString("th-TH")} รายการ · ข้าม ${result.skippedCount.toLocaleString("th-TH")} รายการที่กำลังถูกใช้งาน`);
      else toast.success("ลบข้อมูลที่สร้างจากงานนำเข้าเรียบร้อยแล้ว");
      router.refresh();
    } catch (error) { toast.error("ไม่สามารถลบข้อมูลที่สร้างจากงานนำเข้าได้", error instanceof Error ? error.message : "กรุณาลองใหม่อีกครั้ง"); } });
  };
  const safeToDelete = (cleanupPreflight?.deletablePeople ?? 0) + (cleanupPreflight?.deletableHouses ?? 0);
  return <>
    {canConfirm ? <Button type="button" onClick={() => setDialog("confirm")}>ยืนยันนำเข้าข้อมูล</Button> : null}
    {canCleanup ? <Button type="button" variant="danger" onClick={() => setDialog("cleanup")}><Trash2 className="mr-1.5 h-4 w-4" />ย้อนกลับการนำเข้า</Button> : null}
    <ActionReasonDialog open={dialog === "confirm"} action="population.import" title="ยืนยันนำเข้าข้อมูล" description="ระบบจะบันทึกรายการตามผลตรวจสอบลงในทะเบียนประชากร" reasonLabel="เหตุผล/ที่มาของการนำเข้า" helperText="อย่างน้อย 5 ตัวอักษร" submitLabel="ยืนยันนำเข้าข้อมูล" loading={isPending} onCancel={close} onSubmit={submitConfirm}>
      {fileName ? <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">ชุดข้อมูล: <span className="font-medium">{fileName}</span></p> : null}
      <p className="rounded-lg bg-amber-50 p-3 text-sm leading-5 text-amber-950">การยืนยันนี้จะเปลี่ยนแปลงข้อมูลในทะเบียนประชากรของหมู่บ้าน</p>
      <ul className="space-y-2 text-sm text-gray-700"><li>สร้างใหม่ {createdRows.toLocaleString("th-TH")} รายการ</li><li>อัปเดตข้อมูล {updatedRows.toLocaleString("th-TH")} รายการ</li><li>ต้องตรวจสอบ {conflictRows.toLocaleString("th-TH")} รายการ</li>{failedRows > 0 ? <li>ไม่สามารถนำเข้า {failedRows.toLocaleString("th-TH")} รายการ</li> : null}</ul>
      {conflictRows > 0 || failedRows > 0 ? <p className="mt-3 rounded-lg bg-gray-50 p-3 text-sm leading-5 text-gray-600">รายการที่ต้องตรวจสอบหรือไม่สามารถนำเข้าจะไม่ถูกบันทึกในการยืนยันครั้งนี้</p> : null}
    </ActionReasonDialog>
    <ActionReasonDialog open={dialog === "cleanup" && safeToDelete > 0} action="population.import.rollback" title="ย้อนกลับการนำเข้า" description="ระบบจะลบเฉพาะข้อมูลที่ชุดนี้สร้างขึ้นและยังปลอดภัยต่อการลบ" reasonLabel="เหตุผลในการดำเนินการ" submitLabel="ยืนยันย้อนกลับการนำเข้า" loading={isPending} onCancel={close} onSubmit={submitCleanup}>
      <div className="flex gap-3 rounded-lg bg-red-50 p-3 text-sm leading-5 text-red-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><p>ข้อมูลเดิมที่ถูกอัปเดตจากงานนี้จะไม่ถูกกู้คืนเป็นค่าเดิมโดยอัตโนมัติ</p></div>
      <section className="mt-4"><h3 className="text-sm font-semibold text-gray-900">สามารถลบได้</h3><ul className="mt-2 space-y-1 text-sm text-gray-700"><li>บุคคล {(cleanupPreflight?.deletablePeople ?? 0).toLocaleString("th-TH")} รายการ</li><li>บ้าน {(cleanupPreflight?.deletableHouses ?? 0).toLocaleString("th-TH")} หลัง</li></ul></section>
      {(cleanupPreflight?.skipped.length ?? 0) > 0 ? <section className="mt-4 border-t border-gray-100 pt-4"><h3 className="text-sm font-semibold text-gray-900">ไม่สามารถลบได้ {(cleanupPreflight?.skipped.length ?? 0).toLocaleString("th-TH")} รายการ</h3><ul className="mt-2 space-y-1 text-sm text-gray-600">{Object.entries(cleanupPreflight?.skippedReasonCounts ?? {}).sort(([, left], [, right]) => right - left).map(([reason, count]) => <li key={reason}>{reason} {count.toLocaleString("th-TH")}</li>)}</ul><div className="mt-3 max-h-[min(18rem,35dvh)] overflow-y-auto rounded-lg border border-gray-100"><ul className="divide-y divide-gray-100 text-sm text-gray-600">{cleanupPreflight!.skipped.map((item, index) => <li key={`${item.kind}-${item.label}-${index}`} className="px-3 py-2"><span className="font-medium text-gray-800">{item.label}</span><span className="text-gray-400"> · </span>{item.reason}</li>)}</ul></div></section> : null}
    </ActionReasonDialog>
  </>;
}
