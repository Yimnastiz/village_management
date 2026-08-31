"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { ActionReasonDialog } from "@/components/admin/action-reason-dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PersonGenderSelect, PersonNameInput, ThaiNationalIdInput, ThaiPhoneInput } from "@/components/person/person-form-inputs";
import { useToast } from "@/components/ui/toast";
import { isValidOptionalThaiPhone, isValidPersonName, PERSON_GENDER_VALUES } from "@/lib/person-validation";
import type { VillagePersonInput } from "@/features/population/server/village-population-service";

type Result =
  | {
      success: true;
      id?: string;
      message: string;
    }
  | {
      success: false;
      error: string;
    };

type VillagePersonFormProps = {
  action: (data: VillagePersonInput) => Promise<Result>;
  mode: "create" | "edit";
  houseOptions: Array<{
    value: string;
    label: string;
  }>;
  defaultValues?: VillagePersonInput;
  /** Base list URL for creation, or concrete detail URL for editing. */
  successPath: string;
  /** Delay the Super Admin support reason until final save confirmation. */
  confirmReason?: boolean;
};

const SUPPORT_REASON_MIN_LENGTH = 5;
const SUPPORT_REASON_MAX_LENGTH = 500;

export function VillagePersonForm({
  action,
  mode,
  houseOptions,
  defaultValues,
  successPath,
  confirmReason = false,
}: VillagePersonFormProps) {
  const router = useRouter();
  const toast = useToast();
  const [reasonDialogOpen, setReasonDialogOpen] = useState(false);
  const [stagedData, setStagedData] = useState<VillagePersonInput | null>(null);
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setError,
    formState: {
      errors,
      isSubmitting,
    },
  } = useForm<VillagePersonInput>({
    defaultValues: {
      firstName: defaultValues?.firstName ?? "",
      lastName: defaultValues?.lastName ?? "",
      nationalId: defaultValues?.nationalId ?? "",
      dateOfBirth: defaultValues?.dateOfBirth ?? "",
      gender: defaultValues?.gender ?? "",
      phone: defaultValues?.phone ?? "",
      email: defaultValues?.email ?? "",
      status: defaultValues?.status ?? "ACTIVE",
      houseId: defaultValues?.houseId ?? "",

      // Support Reason must never be reused from a previous mutation.
      reason: "",
    },
  });

  const submitMutation = async (data: VillagePersonInput) => {
    const supportReason = data.reason?.trim() ?? "";

    if (supportReason.length < SUPPORT_REASON_MIN_LENGTH) {
      const errorMessage = `กรุณาระบุเหตุผลในการดำเนินการอย่างน้อย ${SUPPORT_REASON_MIN_LENGTH} ตัวอักษร`;

      setError("reason", {
        type: "manual",
        message: errorMessage,
      });

      return false;
    }

    if (supportReason.length > SUPPORT_REASON_MAX_LENGTH) {
      const errorMessage = `เหตุผลในการดำเนินการต้องไม่เกิน ${SUPPORT_REASON_MAX_LENGTH} ตัวอักษร`;

      setError("reason", {
        type: "manual",
        message: errorMessage,
      });

      return false;
    }

    const result = await action({
      ...data,
      reason: supportReason,
    });

    if (!result.success) {
      setError("root", {
        message: result.error,
      });

      toast.error(
        mode === "create"
          ? "เพิ่มบุคคลไม่สำเร็จ"
          : "แก้ไขข้อมูลประชากรไม่สำเร็จ",
        result.error,
      );

      return false;
    }

    toast.success(result.message);
    setReasonDialogOpen(false);
    router.push(mode === "create" && result.id ? `${successPath}/${result.id}` : successPath);
    router.refresh();
    return true;
  };

  const onSubmit = handleSubmit(async (data) => {
    if (confirmReason) {
      setStagedData(data);
      setReasonDialogOpen(true);
      return;
    }
    await submitMutation(data);
  });

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-5 rounded-xl border border-slate-200 bg-white p-4 sm:p-6"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <PersonNameInput
          label="ชื่อ"
          required
          error={errors.firstName?.message}
          {...register("firstName", {
            required: "กรุณาระบุชื่อ",
            validate: (value) => isValidPersonName(value) || "ชื่อใช้ได้เฉพาะตัวอักษร เว้นวรรค เครื่องหมาย - ' และ .",
          })}
        />

        <PersonNameInput
          label="นามสกุล"
          required
          error={errors.lastName?.message}
          {...register("lastName", {
            required: "กรุณาระบุนามสกุล",
            validate: (value) => isValidPersonName(value) || "นามสกุลใช้ได้เฉพาะตัวอักษร เว้นวรรค เครื่องหมาย - ' และ .",
          })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ThaiNationalIdInput
          label="เลขบัตรประชาชน"
          error={errors.nationalId?.message}
          {...register("nationalId", { validate: (value) => !value || /^\d{13}$/.test(value) || "เลขบัตรประชาชนต้องมี 13 หลัก" })}
        />

        <Input
          label="วันเกิด"
          type="date"
          error={errors.dateOfBirth?.message}
          {...register("dateOfBirth")}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <PersonGenderSelect
          label="เพศ"
          error={errors.gender?.message}
          {...register("gender", { validate: (value) => PERSON_GENDER_VALUES.includes(value as (typeof PERSON_GENDER_VALUES)[number]) || "ข้อมูลเพศไม่ถูกต้อง" })}
          required
        />

        <ThaiPhoneInput
          label="เบอร์โทร"
          error={errors.phone?.message}
          {...register("phone", { validate: (value) => isValidOptionalThaiPhone(value) || "กรุณาระบุเบอร์โทร 10 หลัก" })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="อีเมล"
          type="email"
          error={errors.email?.message}
          {...register("email")}
        />

      </div>

      <Select
        label="บ้านที่ผูก"
        error={errors.houseId?.message}
        {...register("houseId")}
        options={houseOptions}
        placeholder="ไม่ผูกกับบ้าน"
        helperText="แสดงเฉพาะบ้านภายในหมู่บ้านเป้าหมาย"
      />

      {!confirmReason ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <Textarea
          label="เหตุผลประกอบการดำเนินการ"
          required
          maxLength={SUPPORT_REASON_MAX_LENGTH}
          placeholder={
            mode === "create"
              ? "ระบุเหตุผลที่ผู้ดูแลระบบระดับสูงเพิ่มข้อมูลประชากรแทนผู้ดูแลหมู่บ้าน"
              : "ระบุเหตุผลที่ผู้ดูแลระบบระดับสูงแก้ไขข้อมูลประชากรแทนผู้ดูแลหมู่บ้าน"
          }
          error={errors.reason?.message}
          helperText={`จำเป็นสำหรับการตรวจสอบย้อนหลัง อย่างน้อย ${SUPPORT_REASON_MIN_LENGTH} ตัวอักษร และไม่เกิน ${SUPPORT_REASON_MAX_LENGTH} ตัวอักษร`}
          {...register("reason", {
            required: "กรุณาระบุเหตุผลประกอบการดำเนินการ",
            validate: {
              minimumLength: (value) =>
                (value?.trim().length ?? 0) >= SUPPORT_REASON_MIN_LENGTH ||
                `กรุณาระบุเหตุผลอย่างน้อย ${SUPPORT_REASON_MIN_LENGTH} ตัวอักษร`,
              maximumLength: (value) =>
                (value?.trim().length ?? 0) <= SUPPORT_REASON_MAX_LENGTH ||
                `เหตุผลต้องไม่เกิน ${SUPPORT_REASON_MAX_LENGTH} ตัวอักษร`,
            },
          })}
        />
      </div> : null}

      {errors.root?.message ? (
        <p
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
        >
          {errors.root.message}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting || pending}
          className="w-full sm:w-auto"
        >
          ยกเลิก
        </Button>

        <Button
          type="submit"
          isLoading={isSubmitting || pending}
          disabled={pending}
          className="w-full sm:w-auto"
        >
          {mode === "create"
            ? "เพิ่มบุคคล"
            : "บันทึกการแก้ไข"}
        </Button>
      </div>

      {confirmReason ? <ActionReasonDialog open={reasonDialogOpen} action="population.person.edit" title={mode === "create" ? "ยืนยันการเพิ่มบุคคล" : "ยืนยันการแก้ไขข้อมูลบุคคล"} description="กรุณาระบุเหตุผลในการดำเนินการ ระบบจะบันทึกรายการนี้ใน Audit Log" reasonLabel="เหตุผลในการดำเนินการ" helperText="ระบุเหตุผลที่ผู้ดูแลระบบระดับสูงเพิ่มข้อมูลประชากรแทนผู้ดูแลหมู่บ้าน" submitLabel={mode === "create" ? "ยืนยันเพิ่มบุคคล" : "ยืนยันบันทึกการแก้ไข"} requireReason minReasonLength={SUPPORT_REASON_MIN_LENGTH} maxReasonLength={SUPPORT_REASON_MAX_LENGTH} loading={pending} onCancel={() => setReasonDialogOpen(false)} onSubmit={(reason) => { if (!stagedData) return; startTransition(() => { void submitMutation({ ...stagedData, reason }); }); }} /> : null}
    </form>
  );
}
