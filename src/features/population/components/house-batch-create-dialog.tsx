"use client";

import { FormEvent, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { createHousesAction } from "@/app/(admin)/admin/population/houses/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { isValidHouseNumber, normalizeHouseNumber } from "@/lib/house-number";

const MAX_BATCH_SIZE = 50;
type DraftHouse = { id: string; houseNumber: string; address: string };
type Entry = Omit<DraftHouse, "id">;
type FieldErrors = Record<string, Partial<Record<"houseNumber" | "address", string>>>;

function makeDraft(): Entry { return { houseNumber: "", address: "" }; }

export function HouseBatchCreateDialog({ compact = false }: { compact?: boolean }) {
  const dialogId = useId();
  const toast = useToast();
  const router = useRouter();
  const houseNumberRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Entry>(makeDraft());
  const [items, setItems] = useState<DraftHouse[]>([]);
  const [draftError, setDraftError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [pending, startTransition] = useTransition();

  const resetAndClose = () => {
    if (pending) return;
    setOpen(false); setDraft(makeDraft()); setItems([]); setDraftError(undefined); setFieldErrors({});
  };

  const stageDraft = () => {
    const houseNumber = draft.houseNumber.trim();
    if (!houseNumber) { setDraftError("กรุณาระบุบ้านเลขที่"); houseNumberRef.current?.focus(); return false; }
    if (!isValidHouseNumber(houseNumber)) { setDraftError("กรุณากรอกบ้านเลขที่ให้ถูกต้อง เช่น 99 หรือ 99/1"); houseNumberRef.current?.focus(); return false; }
    if (items.length >= MAX_BATCH_SIZE) { setDraftError("เพิ่มได้สูงสุด 50 หลังต่อครั้ง"); return false; }
    if (items.some((item) => normalizeHouseNumber(item.houseNumber) === normalizeHouseNumber(houseNumber))) {
      setDraftError("บ้านเลขที่นี้ซ้ำกับรายการที่เพิ่มแล้ว"); houseNumberRef.current?.focus(); return false;
    }
    setItems((current) => [...current, { id: crypto.randomUUID(), houseNumber, address: draft.address.trim() }]);
    setDraft(makeDraft()); setDraftError(undefined);
    requestAnimationFrame(() => houseNumberRef.current?.focus());
    return true;
  };

  const addDraft = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!pending) stageDraft(); };
  const removeItem = (id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
    setFieldErrors((current) => { const next = { ...current }; delete next[id]; return next; });
  };

  const submit = () => {
    let itemsToSubmit = items;
    if (draft.houseNumber.trim()) {
      const houseNumber = draft.houseNumber.trim();
      if (!isValidHouseNumber(houseNumber)) { setDraftError("กรุณากรอกบ้านเลขที่ให้ถูกต้อง เช่น 99 หรือ 99/1"); houseNumberRef.current?.focus(); return; }
      if (items.some((item) => normalizeHouseNumber(item.houseNumber) === normalizeHouseNumber(houseNumber))) { setDraftError("บ้านเลขที่นี้ซ้ำกับรายการที่เพิ่มแล้ว"); houseNumberRef.current?.focus(); return; }
      if (items.length >= MAX_BATCH_SIZE) { setDraftError("เพิ่มได้สูงสุด 50 หลังต่อครั้ง"); return; }
      itemsToSubmit = [...items, { id: crypto.randomUUID(), houseNumber, address: draft.address.trim() }];
      setItems(itemsToSubmit); setDraft(makeDraft()); setDraftError(undefined);
    }
    if (!itemsToSubmit.length) { setDraftError("กรุณาเพิ่มบ้านอย่างน้อย 1 หลัง"); houseNumberRef.current?.focus(); return; }

    startTransition(async () => {
      const result = await createHousesAction(itemsToSubmit.map(({ houseNumber, address }) => ({ houseNumber, address })));
      if (!result.success) {
        if (result.errors) {
          const nextErrors: FieldErrors = {};
          result.errors.forEach((error) => { const item = itemsToSubmit[error.index]; if (item) nextErrors[item.id] = { ...nextErrors[item.id], [error.field]: error.message }; });
          setFieldErrors(nextErrors);
        } else if (result.error) toast.error("เพิ่มบ้านไม่สำเร็จ", result.error);
        return;
      }
      toast.success(result.message);
      setOpen(false); setDraft(makeDraft()); setItems([]); setDraftError(undefined); setFieldErrors({});
      router.refresh();
    });
  };

  const confirmCount = items.length + (draft.houseNumber.trim() ? 1 : 0);

  return <>
    <Button type="button" className="min-h-11" onClick={() => setOpen(true)}><span>{compact ? "Add house" : "Add house"}</span></Button>
    <Dialog open={open} onClose={resetAndClose} title="เพิ่มบ้าน" description="เพิ่มบ้านไว้ในรายการก่อนตรวจสอบและยืนยันการบันทึก" className="sm:max-w-3xl" footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="outline" className="min-h-11" onClick={resetAndClose} disabled={pending}>ยกเลิก</Button><Button type="button" className="min-h-11" onClick={submit} isLoading={pending} disabled={pending}>{confirmCount ? `ยืนยันเพิ่มบ้าน ${confirmCount} หลัง` : "ยืนยันเพิ่มบ้าน"}</Button></div>}>
      <div className="space-y-5">
        <form className="grid gap-3 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)_auto] md:items-end" onSubmit={addDraft}>
          <Input ref={houseNumberRef} id={`${dialogId}-number`} label="บ้านเลขที่" required maxLength={50} placeholder="เช่น 99/1" value={draft.houseNumber} onChange={(event) => { setDraft((current) => ({ ...current, houseNumber: event.target.value })); setDraftError(undefined); }} error={draftError} disabled={pending} />
          <Input id={`${dialogId}-address`} label="ที่อยู่เพิ่มเติม" maxLength={300} placeholder="ซอย จุดสังเกต หรือรายละเอียดที่ช่วยระบุตำแหน่งบ้าน" value={draft.address} onChange={(event) => setDraft((current) => ({ ...current, address: event.target.value }))} disabled={pending} />
          <Button type="submit" className="min-h-11 w-full md:w-auto" disabled={pending || items.length >= MAX_BATCH_SIZE}>Add</Button>
        </form>
        {items.length >= MAX_BATCH_SIZE ? <p className="text-sm text-gray-500">เพิ่มได้สูงสุด 50 หลังต่อครั้ง</p> : null}
        {items.length ? <section aria-labelledby={`${dialogId}-staged-title`} className="space-y-2">
          <h3 id={`${dialogId}-staged-title`} className="text-sm font-medium text-gray-700">รายการที่จะเพิ่ม — {items.length} หลัง</h3>
          <div className="space-y-2">
            {items.map((item, index) => <article key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-3">
              <div className="min-w-0"><p className="text-xs font-medium text-gray-500">บ้าน {index + 1}</p><p className="mt-0.5 truncate font-medium text-gray-900">{item.houseNumber}{item.address ? <span className="font-normal text-gray-600"> · {item.address}</span> : null}</p>{fieldErrors[item.id]?.houseNumber || fieldErrors[item.id]?.address ? <p className="mt-1 text-xs text-red-600">{fieldErrors[item.id]?.houseNumber ?? fieldErrors[item.id]?.address}</p> : null}</div>
              <Button type="button" variant="dangerOutline" size="sm" className="min-h-11 shrink-0 gap-1.5" aria-label={`ลบบ้านรายการที่ ${index + 1}`} onClick={() => removeItem(item.id)} disabled={pending}><Trash2 className="h-4 w-4" aria-hidden="true" />ลบ</Button>
            </article>)}
          </div>
        </section> : null}
      </div>
    </Dialog>
  </>;
}
