"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
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
  houseId: string;
  reason?: string;
};

type PersonFormProps = {
  mode: "create" | "edit";
  personId?: string;
  houseOptions: HouseOption[];
  defaultValues?: FormValues;
  identityLocked?: boolean;
  movedOut?: boolean;
};

export function PersonForm({ mode, personId, houseOptions, defaultValues, identityLocked = false, movedOut = false }: PersonFormProps) {
  const router = useRouter();
  const toast = useToast();
  const { register, handleSubmit, setError, setFocus, watch, formState: { errors, isSubmitting } } = useForm<FormValues>({
    defaultValues: defaultValues ?? { firstName: "", lastName: "", nationalId: "", dateOfBirth: "", gender: "", phone: "", email: "", houseId: "", reason: "" },
  });
  const houseId = watch("houseId");
  const houseChanged = mode === "edit" && houseId !== (defaultValues?.houseId ?? "");

  const submit = async (data: FormValues) => {
    if (houseChanged && (data.reason?.trim().length ?? 0) < 5) {
      setError("reason", { message: "กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร" });
      setFocus("reason");
      return;
    }
    const result = mode === "create" ? await createPersonAction(data) : await updatePersonAction(personId ?? "", data);
    if (!result.success) {
      setError("root", { message: result.error });
      if (result.error.includes("เหตุผล")) { setError("reason", { message: result.error }); setFocus("reason"); }
      if (result.error.includes("เลขบัตรประชาชน")) setError("nationalId", { message: result.error });
      toast.error(mode === "create" ? "เพิ่มข้อมูลประชากรไม่สำเร็จ" : "แก้ไขข้อมูลประชากรไม่สำเร็จ", result.error);
      return;
    }
    toast.success(mode === "create" ? "เพิ่มข้อมูลประชากรสำเร็จ" : "แก้ไขข้อมูลประชากรสำเร็จ");
    router.push(`/admin/population/people/${mode === "create" ? result.id : personId}`);
    router.refresh();
  };

  return <form onSubmit={handleSubmit(submit)} className="space-y-6 rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
    {identityLocked ? <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">ข้อมูลระบุตัวตนนี้เชื่อมกับบัญชีผู้ใช้แล้ว เพื่อป้องกันข้อมูลบัญชีไม่ตรงกัน ผู้ใหญ่บ้านไม่สามารถแก้ไขชื่อ นามสกุล เลขบัตรประชาชน และเบอร์เข้าสู่ระบบจากหน้านี้ได้</p> : null}
    {movedOut ? <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">บุคคลนี้ย้ายออกจากทะเบียนแล้ว จึงไม่สามารถผูกบ้านหรือกลับเข้าสถานะเดิมจากหน้านี้ได้</p> : null}

    <fieldset className="space-y-4"><legend className="text-sm font-semibold text-gray-900">ข้อมูลระบุตัวตน</legend>
      <div className="grid gap-4 sm:grid-cols-2"><Input label="ชื่อ" {...register("firstName")} error={errors.firstName?.message} required disabled={identityLocked} /><Input label="นามสกุล" {...register("lastName")} error={errors.lastName?.message} required disabled={identityLocked} /></div>
      <div className="grid gap-4 sm:grid-cols-2"><Input label="เลขบัตรประชาชน" inputMode="numeric" maxLength={13} {...register("nationalId")} error={errors.nationalId?.message} disabled={identityLocked} /><Input label="วันเกิด" type="date" {...register("dateOfBirth")} error={errors.dateOfBirth?.message} /></div>
      <Input label="เพศ" {...register("gender")} error={errors.gender?.message} />
    </fieldset>

    <fieldset className="space-y-4 border-t border-gray-100 pt-5"><legend className="text-sm font-semibold text-gray-900">ข้อมูลติดต่อ</legend>
      <div className="grid gap-4 sm:grid-cols-2"><Input label="เบอร์โทร" inputMode="tel" {...register("phone")} error={errors.phone?.message} disabled={identityLocked} helperText={identityLocked ? "เบอร์นี้เชื่อมกับบัญชีผู้ใช้และใช้สำหรับเข้าสู่ระบบ หากต้องการเปลี่ยนเบอร์ ให้ดำเนินการผ่านการเปลี่ยนเบอร์บัญชีผู้ใช้" : undefined} /><Input label="อีเมล" type="email" {...register("email")} error={errors.email?.message} /></div>
    </fieldset>

    <fieldset className="space-y-4 border-t border-gray-100 pt-5"><legend className="text-sm font-semibold text-gray-900">ข้อมูลทะเบียน</legend>
      <Select label="บ้านปัจจุบัน" {...register("houseId")} options={houseOptions} placeholder="ยังไม่ระบุบ้าน" disabled={movedOut} helperText={movedOut ? "หากกลับมาอยู่ใหม่ ให้ส่งคำขอผูกเลขบ้านใหม่" : ""} />
    </fieldset>

    {mode === "edit" ? <fieldset className="space-y-2 border-t border-gray-100 pt-5"><legend className="text-sm font-semibold text-gray-900">เหตุผลการเปลี่ยนแปลง</legend><Input label={houseChanged ? "เหตุผลการเปลี่ยนบ้าน *" : "เหตุผล / หมายเหตุการแก้ไข"} {...register("reason")} error={errors.reason?.message} maxLength={300} helperText={houseChanged ? "กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร" : "ระบุเมื่อจำเป็น ข้อมูลสำคัญจะบันทึกใน Audit Log"} /></fieldset> : null}
    {errors.root ? <p className="text-sm text-red-600" role="alert">{errors.root.message}</p> : null}
    <div className="flex flex-wrap gap-3 border-t border-gray-100 pt-5"><Button type="submit" isLoading={isSubmitting}>{mode === "create" ? "เพิ่มบุคคล" : "บันทึกการแก้ไข"}</Button><Button type="button" variant="outline" onClick={() => router.back()}>ย้อนกลับ</Button></div>
  </form>;
}
