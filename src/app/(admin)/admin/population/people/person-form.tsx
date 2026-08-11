"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { PERSON_STATUS_LABELS } from "@/lib/constants";
import { createPersonAction, updatePersonAction } from "./actions";

type HouseOption = { value: string; label: string };

type FormValues = {
  firstName: string;
  lastName: string;
  nationalId: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  email: string;
  status: string;
  houseId: string;
  reason?: string;
};

type PersonFormProps = {
  mode: "create" | "edit";
  personId?: string;
  houseOptions: HouseOption[];
  defaultValues?: FormValues;
  identityLocked?: boolean;
};

export function PersonForm({ mode, personId, houseOptions, defaultValues, identityLocked = false }: PersonFormProps) {
  const router = useRouter();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: defaultValues ?? {
      firstName: "",
      lastName: "",
      nationalId: "",
      dateOfBirth: "",
      gender: "",
      phone: "",
      email: "",
      status: "ACTIVE",
      houseId: "",
    },
  });

  return (
    <form
      onSubmit={handleSubmit(async (data) => {
        if (mode === "create") {
          const result = await createPersonAction(data);
          if (!result.success) {
            setError("root", { message: result.error });
            return;
          }

          router.push(`/admin/population/people/${result.id}`);
          toast.success("เพิ่มข้อมูลบุคคลสำเร็จ");
        } else {
          const result = await updatePersonAction(personId ?? "", data);
          if (!result.success) {
            setError("root", { message: result.error });
            return;
          }

          router.push(`/admin/population/people/${personId}`);
          toast.success("แก้ไขข้อมูลบุคคลสำเร็จ");
        }
        router.refresh();
      })}
      className="space-y-4 rounded-xl border border-gray-200 bg-white p-6"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="ชื่อ" {...register("firstName")} error={errors.firstName?.message} required disabled={identityLocked} />
        <Input label="นามสกุล" {...register("lastName")} error={errors.lastName?.message} required disabled={identityLocked} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="เลขบัตรประชาชน" {...register("nationalId")} error={errors.nationalId?.message} disabled={identityLocked} />
        <Input label="วันเกิด" type="date" {...register("dateOfBirth")} error={errors.dateOfBirth?.message} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="เพศ" {...register("gender")} error={errors.gender?.message} />
        <Input label="เบอร์โทร" {...register("phone")} error={errors.phone?.message} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="อีเมล" type="email" {...register("email")} error={errors.email?.message} />
        <Select
          label="สถานะ"
          {...register("status")}
          options={Object.entries(PERSON_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
        />
      </div>

      <Select
        label="บ้านที่ผูก"
        {...register("houseId")}
        options={houseOptions}
        placeholder="ไม่ผูกกับบ้าน"
      />
      {mode === "edit" ? <Input label="เหตุผล / หมายเหตุการแก้ไข" {...register("reason")} maxLength={300} helperText="ข้อมูลสำคัญจะบันทึกใน Audit Log" /> : null}

      {identityLocked ? <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">ข้อมูลชื่อและเลขบัตรประชาชนนี้ผูกกับบัญชีผู้ใช้แล้ว กรุณาส่งคำขอแก้ไขข้อมูลหรือให้ Super Admin ตรวจสอบ</p> : null}

      {errors.root ? <p className="text-sm text-red-600">{errors.root.message}</p> : null}

      <div className="flex gap-3">
        <Button type="submit" isLoading={isSubmitting}>{mode === "create" ? "เพิ่มบุคคล" : "บันทึกการแก้ไข"}</Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>ย้อนกลับ</Button>
      </div>
    </form>
  );
}
