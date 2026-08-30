"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ActionReasonDialog } from "@/components/admin/action-reason-dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

type Result =
  | {
      success: true;
      id?: string;
      message: string;
    }
  | {
      success: false;
      error: string;
      field?: "houseNumber" | "address" | "reason";
    };

type Props = {
  action: (formData: FormData) => Promise<Result>;
  mode?: "create" | "edit";
  defaults?: {
    houseNumber: string;
    address: string;
  };
  /** Serializable detail URL to return to after a successful edit. */
  successHref?: string;
  /** Client-only callback, for example to close a surrounding dialog. */
  onSuccess?: (id?: string) => void;

  /**
   * Use this for Super Admin village operations.
   *
   * Super Admin mutations must provide a fresh support reason
   * for every create/update operation.
   */
  requireReason?: boolean;
  /** Collect the mandatory support reason only after the user confirms the edit. */
  confirmReason?: boolean;
};

const SUPPORT_REASON_MIN_LENGTH = 5;
const SUPPORT_REASON_MAX_LENGTH = 500;

export function HouseForm({
  action,
  mode = "create",
  defaults,
  successHref,
  onSuccess,
  requireReason = false,
  confirmReason = false,
}: Props) {
  const toast = useToast();
  const router = useRouter();

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<"houseNumber" | "address" | "reason", string>>
  >({});

  const houseNumberRef = useRef<HTMLInputElement>(null);
  const reasonRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const pendingFormDataRef = useRef<FormData | null>(null);
  const [reasonDialogOpen, setReasonDialogOpen] = useState(false);

  const submitAction = (formData: FormData) => {
    startTransition(async () => {
      const result = await action(formData);

      if (!result.success) {
        setError(result.error);

        if (result.field) {
          const fieldMessage = result.field === "houseNumber" && result.error.includes("มีอยู่") ? "บ้านเลขที่นี้มีอยู่แล้ว" : result.error;
          setFieldErrors({ [result.field]: fieldMessage });
          if (result.field === "houseNumber") requestAnimationFrame(() => houseNumberRef.current?.focus());
          if (result.field === "reason") requestAnimationFrame(() => reasonRef.current?.focus());
        }

        toast.error(mode === "create" ? "เพิ่มบ้านไม่สำเร็จ" : "แก้ไขบ้านไม่สำเร็จ", result.error);
        return;
      }

      setReasonDialogOpen(false);
      toast.success(result.message);
      if (mode === "create") formRef.current?.reset();
      onSuccess?.(result.id);
      if (successHref) router.push(successHref);
      router.refresh();
    });
  };

  return (
    <>
    <form
      ref={formRef}
      className="grid grid-cols-1 gap-x-4 gap-y-3 rounded-xl border border-slate-200 bg-white p-3 sm:p-4 md:grid-cols-2 xl:grid-cols-[minmax(160px,0.7fr)_minmax(280px,1.5fr)_auto]"
      onSubmit={(event) => {
        event.preventDefault();

        setError("");
        setFieldErrors({});

        const form = event.currentTarget;
        const formData = new FormData(form);

        if (requireReason && !confirmReason) {
          const supportReason = String(formData.get("reason") ?? "").trim();

          if (supportReason.length < SUPPORT_REASON_MIN_LENGTH) {
            const message = `กรุณาระบุเหตุผลในการดำเนินการอย่างน้อย ${SUPPORT_REASON_MIN_LENGTH} ตัวอักษร`;

            setFieldErrors({
              reason: message,
            });

            requestAnimationFrame(() => {
              reasonRef.current?.focus();
            });

            return;
          }

          if (supportReason.length > SUPPORT_REASON_MAX_LENGTH) {
            const message = `เหตุผลในการดำเนินการต้องไม่เกิน ${SUPPORT_REASON_MAX_LENGTH} ตัวอักษร`;

            setFieldErrors({
              reason: message,
            });

            requestAnimationFrame(() => {
              reasonRef.current?.focus();
            });

            return;
          }

          formData.set("reason", supportReason);
        }

        if (requireReason && confirmReason) {
          pendingFormDataRef.current = formData;
          setReasonDialogOpen(true);
          return;
        }

        submitAction(formData);
      }}
    >
      <div className="w-full">
        <Input
          ref={houseNumberRef}
          id="house-number"
          name="houseNumber"
          label="บ้านเลขที่"
          required
          maxLength={50}
          defaultValue={defaults?.houseNumber}
          placeholder="เช่น 99/1"
          error={fieldErrors.houseNumber}
          className="h-10"
        />
      </div>

      <div className="w-full">
        <Input
          id="house-address"
          name="address"
          label="ที่อยู่เพิ่มเติม"
          placeholder="ซอย จุดสังเกต หรือรายละเอียดที่ช่วยระบุตำแหน่งบ้าน"
          defaultValue={defaults?.address}
          maxLength={300}
          error={fieldErrors.address}
          className="h-10"
        />
      </div>

      <div className="flex items-end">
        <Button
          className="h-10 w-full xl:w-auto"
          type="submit"
          disabled={pending}
          isLoading={pending}
        >
          {mode === "create"
            ? "เพิ่มบ้าน"
            : "บันทึกการแก้ไข"}
        </Button>
      </div>

      {requireReason && !confirmReason ? (
        <div className="md:col-span-2 xl:col-span-3">
          <Input
            ref={reasonRef}
            id="support-reason"
            name="reason"
            label="เหตุผลประกอบการดำเนินการ"
            required
            minLength={SUPPORT_REASON_MIN_LENGTH}
            maxLength={SUPPORT_REASON_MAX_LENGTH}
            placeholder={
              mode === "create"
                ? "ระบุเหตุผลที่ผู้ดูแลระบบระดับสูงเพิ่มบ้านแทนผู้ดูแลหมู่บ้าน"
                : "ระบุเหตุผลที่ผู้ดูแลระบบระดับสูงแก้ไขข้อมูลบ้านแทนผู้ดูแลหมู่บ้าน"
            }
            error={fieldErrors.reason}
            helperText={`เหตุผลนี้ใช้สำหรับ Audit Log โดยต้องมีอย่างน้อย ${SUPPORT_REASON_MIN_LENGTH} ตัวอักษร และไม่เกิน ${SUPPORT_REASON_MAX_LENGTH} ตัวอักษร`}
          />
        </div>
      ) : null}

      {error &&
      !fieldErrors.houseNumber &&
      !fieldErrors.address &&
      !fieldErrors.reason ? (
        <p className="text-sm text-rose-600 md:col-span-full">
          {error}
        </p>
      ) : null}
    </form>
    {requireReason && confirmReason ? <ActionReasonDialog open={reasonDialogOpen} action="population.house.edit" title="ยืนยันการแก้ไขบ้าน" description="กรุณาระบุเหตุผลในการดำเนินการ ระบบจะบันทึกการแก้ไขใน Audit Log" reasonLabel="เหตุผลในการดำเนินการ" submitLabel="ยืนยันบันทึกการแก้ไข" requireReason minReasonLength={SUPPORT_REASON_MIN_LENGTH} maxReasonLength={SUPPORT_REASON_MAX_LENGTH} loading={pending} onCancel={() => setReasonDialogOpen(false)} onSubmit={(reason) => { const formData = pendingFormDataRef.current; if (!formData) return; formData.set("reason", reason); submitAction(formData); }} /> : null}
    </>
  );
}
