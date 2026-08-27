"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { normalizeHouseNumber } from "@/lib/house-number";

type Result = { success: boolean; message?: string };
type Action = (previousState: Result, formData: FormData) => Promise<Result>;
type House = { id: string; houseNumber: string };

type Props = {
  requestId: string;
  applicantName?: string;
  houseId: string | null;
  requestedHouseNumber: string | null;
  resolvedHouseNumber: string | null;
  houses: House[];
  reviewAction: Action;
  verifyAction: Action;
  houseMismatch?: boolean;
  nationalIdClaimed?: boolean;
  personHouseNumber?: string | null;
};

export function BindingReviewForm({
  requestId,
  applicantName = "ผู้ขอ",
  houseId,
  requestedHouseNumber,
  resolvedHouseNumber,
  houses,
  reviewAction,
  verifyAction,
  houseMismatch = false,
  nationalIdClaimed = false,
  personHouseNumber = null,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectOpen, setSelectOpen] = useState(false);
  const [matchOpen, setMatchOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [sourceNote, setSourceNote] = useState("");
  const [matchReason, setMatchReason] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [query, setQuery] = useState("");
  const [selectedHouse, setSelectedHouse] = useState<House | null>(null);
  const ready = Boolean(houseId) && !nationalIdClaimed;
  const displayTargetHouse = resolvedHouseNumber ?? requestedHouseNumber ?? "-";
  const selectedNumberDiffers = Boolean(
    selectedHouse && requestedHouseNumber && normalizeHouseNumber(selectedHouse.houseNumber) !== normalizeHouseNumber(requestedHouseNumber),
  );
  const filteredHouses = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("th");
    return normalized
      ? houses.filter((house) => house.houseNumber.toLocaleLowerCase("th").includes(normalized))
      : houses;
  }, [houses, query]);

  const run = (action: Action, formData: FormData, successMessage: string, close?: () => void) => {
    startTransition(async () => {
      const result = await action({ success: false }, formData);
      if (!result.success) {
        toast.error("ไม่สามารถดำเนินการได้", result.message);
        return;
      }
      toast.success(successMessage, result.message);
      close?.();
      router.refresh();
    });
  };

  const resolveHouse = (mode: "create" | "select") => {
    const data = new FormData();
    data.set("requestId", requestId);
    data.set("resolutionAction", mode);
    if (mode === "select" && selectedHouse) data.set("selectedHouseId", selectedHouse.id);
    if (mode === "select" && selectedNumberDiffers) data.set("matchReason", matchReason.trim());
    data.set(
      "sourceNote",
      mode === "create"
        ? sourceNote.trim()
        : selectedNumberDiffers
          ? matchReason.trim()
          : `จับคู่บ้านเลขที่ ${selectedHouse?.houseNumber ?? "-"} ตามการตรวจสอบคำขอ`,
    );
    run(
      verifyAction,
      data,
      mode === "create" ? "สร้างบ้านและผูกกับคำขอแล้ว" : "จับคู่บ้านกับคำขอแล้ว",
      () => {
        setCreateOpen(false);
        setSelectOpen(false);
        setMatchOpen(false);
      },
    );
  };

  const approve = () => {
    const data = new FormData();
    data.set("requestId", requestId);
    data.set("action", "approve");
    if (reviewNote.trim()) data.set("reviewNote", reviewNote.trim());
    if (houseMismatch) data.set("confirmPersonHouseChange", "true");
    run(reviewAction, data, "อนุมัติคำขอเรียบร้อยแล้ว", () => setApproveOpen(false));
  };

  return (
    <section className="space-y-5 rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      {!houseId ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="font-medium text-amber-950">ไม่พบบ้านเลขที่ {requestedHouseNumber ?? "-"} ในทะเบียนบ้าน</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Button type="button" onClick={() => setCreateOpen(true)} disabled={pending} className="w-full">
              สร้างบ้านเลขที่ {requestedHouseNumber ?? "-"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setSelectOpen(true)} disabled={pending} className="w-full bg-white">
              เลือกบ้านที่มีอยู่แทน
            </Button>
          </div>
        </div>
      ) : null}

      {nationalIdClaimed ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-950" role="alert">
          <p className="font-semibold">ไม่สามารถอนุมัติได้</p>
          <p className="mt-1 text-sm">เลขบัตรประชาชนนี้ถูกใช้กับบัญชีที่ผูกบ้านแล้ว</p>
        </div>
      ) : null}

      {houseId && houseMismatch ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">ข้อมูลทะเบียนไม่ตรงกับคำขอ</p>
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-amber-800">ทะเบียนปัจจุบัน</dt><dd className="mt-1 break-words font-medium">บ้านเลขที่ {personHouseNumber ?? "-"}</dd></div>
                <div><dt className="text-amber-800">บ้านที่จะผูกตามคำขอ</dt><dd className="mt-1 break-words font-medium">บ้านเลขที่ {displayTargetHouse}</dd></div>
              </dl>
              <p className="mt-3 text-sm leading-6">หากอนุมัติ ระบบจะย้ายข้อมูลบุคคลจากบ้านเลขที่ {personHouseNumber ?? "-"} ไปยังบ้านเลขที่ {displayTargetHouse} และบันทึกประวัติการย้าย</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="border-t border-gray-200 pt-4">
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => setRejectOpen(true)} disabled={pending} className="w-full sm:w-auto">ปฏิเสธ</Button>
          <Button type="button" onClick={() => setApproveOpen(true)} disabled={!ready || pending} className="w-full sm:w-auto">
            {houseMismatch ? "ยืนยันเปลี่ยนบ้านและอนุมัติ" : "อนุมัติ"}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={createOpen}
        title="สร้างบ้านจากคำขอ"
        description={`บ้านเลขที่: ${requestedHouseNumber ?? "-"}`}
        confirmLabel="สร้างบ้าน"
        pending={pending}
        confirmDisabled={sourceNote.trim().length < 5}
        onClose={() => setCreateOpen(false)}
        onConfirm={() => resolveHouse("create")}
      >
        <label className="block text-sm font-medium text-slate-700">แหล่งที่มา / เหตุผลการตรวจสอบ <span className="text-rose-600">*</span>
          <textarea autoFocus rows={4} value={sourceNote} onChange={(event) => setSourceNote(event.target.value)} className="mt-1 w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
      </ConfirmDialog>

      <ConfirmDialog open={selectOpen} title="เลือกบ้านที่มีอยู่ในทะเบียน" confirmLabel="เลือกบ้านนี้" pending={pending} confirmDisabled={!selectedHouse} onClose={() => setSelectOpen(false)} onConfirm={() => { setSelectOpen(false); setMatchOpen(true); }}>
        <label className="relative block">
          <span className="sr-only">ค้นหาเลขบ้าน</span><Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-400" />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาเลขบ้าน" className="min-h-10 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm" />
        </label>
        <div className="mt-3 max-h-[45vh] space-y-1 overflow-y-auto rounded-lg border p-1">
          {filteredHouses.map((house) => <button key={house.id} type="button" onClick={() => setSelectedHouse(house)} className={`block min-h-10 w-full break-words rounded-md px-3 py-2 text-left text-sm ${selectedHouse?.id === house.id ? "bg-emerald-100 font-medium text-emerald-950" : "hover:bg-slate-50"}`}>บ้านเลขที่ {house.houseNumber}</button>)}
          {!filteredHouses.length ? <p className="p-4 text-center text-sm text-slate-500">ไม่พบบ้านที่ค้นหา</p> : null}
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={matchOpen}
        title="ยืนยันการจับคู่"
        description={`เลขบ้านที่ผู้ใช้แจ้ง: ${requestedHouseNumber ?? "-"}\nบ้านที่เลือกในระบบ: ${selectedHouse?.houseNumber ?? "-"}`}
        confirmLabel="ยืนยัน"
        pending={pending}
        confirmDisabled={!selectedHouse || (selectedNumberDiffers && matchReason.trim().length < 5)}
        onClose={() => { setMatchOpen(false); setSelectOpen(true); }}
        onConfirm={() => resolveHouse("select")}
      >
        {selectedNumberDiffers ? <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"><p className="font-semibold">เลขบ้านไม่ตรงกับข้อมูลที่ผู้ใช้แจ้ง</p><label className="mt-3 block font-medium">เหตุผลการจับคู่ <span className="text-rose-600">*</span><textarea autoFocus rows={3} value={matchReason} onChange={(event) => setMatchReason(event.target.value)} className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm" /></label></div> : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={approveOpen}
        title={houseMismatch ? "ยืนยันการเปลี่ยนบ้าน" : "ยืนยันการผูกบ้าน"}
        description={houseMismatch ? `${applicantName}\nจากบ้านเลขที่ ${personHouseNumber ?? "-"}\nไปบ้านเลขที่ ${displayTargetHouse}\n\nระบบจะบันทึกประวัติการย้ายบ้าน` : `บัญชี: ${applicantName}\nบ้านเลขที่: ${displayTargetHouse}\n\nหลังอนุมัติ ผู้ใช้จะได้รับสิทธิ์ลูกบ้านของหมู่บ้านนี้`}
        confirmLabel={houseMismatch ? "ยืนยันและอนุมัติ" : "ยืนยันอนุมัติ"}
        pending={pending}
        confirmDisabled={houseMismatch && reviewNote.trim().length < 5}
        onClose={() => setApproveOpen(false)}
        onConfirm={approve}
      >
        <label className="block text-sm font-medium text-slate-700">{houseMismatch ? <>เหตุผลการอนุมัติข้ามความไม่ตรงกัน <span className="text-rose-600">*</span></> : "หมายเหตุการอนุมัติ (ไม่บังคับ)"}<textarea rows={3} value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />{houseMismatch ? <span className="mt-1 block text-xs text-slate-500">อย่างน้อย 5 ตัวอักษร</span> : null}</label>
      </ConfirmDialog>

      <ConfirmDialog open={rejectOpen} title="ปฏิเสธคำขอผูกเลขบ้าน" confirmLabel="ยืนยันการปฏิเสธ" tone="danger" pending={pending} confirmDisabled={rejectReason.trim().length < 5} onClose={() => setRejectOpen(false)} onConfirm={() => {
        const data = new FormData();
        data.set("requestId", requestId);
        data.set("action", "reject");
        data.set("reviewNote", rejectReason.trim());
        run(reviewAction, data, "ปฏิเสธคำขอเรียบร้อยแล้ว", () => setRejectOpen(false));
      }}>
        <label className="block text-sm font-medium text-slate-700">กรุณาระบุเหตุผล <span className="text-rose-600">*</span><textarea autoFocus required rows={4} value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /><span className="mt-1 block text-xs text-slate-500">อย่างน้อย 5 ตัวอักษร</span></label>
      </ConfirmDialog>
    </section>
  );
}
