"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PersonGenderSelect, PersonNameInput, ThaiNationalIdInput, ThaiPhoneInput } from "@/components/person/person-form-inputs";
import { useToast } from "@/components/ui/toast";
import { isValidOptionalThaiPhone, isValidPersonName, normalizePersonName, PERSON_GENDER_VALUES, validateOptionalPersonDate } from "@/lib/person-validation";
import { isThaiNationalIdFormat, isValidStrictThaiNationalId } from "@/lib/thai-identity";
import { isSameNationalId } from "@/lib/person-national-id";
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
  linkedAccount?: { phoneNumber: string; email: string | null } | null;
  movedOut?: boolean;
  deceased?: boolean;
  allowNationalIdChecksumBypass?: boolean;
};

const NAME_ERROR = "ใช้ได้เฉพาะตัวอักษร เว้นวรรค เครื่องหมาย - ' และ .";

export function PersonForm({ mode, personId, houseOptions, defaultValues, linkedAccount = null, movedOut = false, deceased = false, allowNationalIdChecksumBypass = false }: PersonFormProps) {
  const router = useRouter();
  const toast = useToast();
  const { register, handleSubmit, setError, setFocus, watch, formState: { errors, isSubmitting } } = useForm<FormValues>({
    mode: "onBlur",
    defaultValues: defaultValues ?? { firstName: "", lastName: "", nationalId: "", dateOfBirth: "", gender: "ไม่ระบุ", phone: "", email: "", houseId: "", reason: "" },
  });
  const houseId = watch("houseId");
  const firstName = watch("firstName");
  const lastName = watch("lastName");
  const gender = watch("gender");
  const dateOfBirth = watch("dateOfBirth");
  const houseChanged = mode === "edit" && houseId !== (defaultValues?.houseId ?? "");
  const linkedNameChanged = Boolean(linkedAccount) && mode === "edit" && (normalizePersonName(firstName) !== defaultValues?.firstName || normalizePersonName(lastName) !== defaultValues?.lastName);
  const sensitiveIdentityChanged = mode === "edit" && ((Boolean(defaultValues?.gender) && gender !== defaultValues?.gender) || (Boolean(defaultValues?.dateOfBirth) && dateOfBirth !== defaultValues?.dateOfBirth));
  const reasonRequired = houseChanged || linkedNameChanged || sensitiveIdentityChanged;

  const submit = async (data: FormValues) => {
    if (reasonRequired && (data.reason?.trim().length ?? 0) < 5) {
      setError("reason", { message: "กรุณาระบุเหตุผลการแก้ไขข้อมูลสำคัญอย่างน้อย 5 ตัวอักษร" });
      setFocus("reason");
      return;
    }
    // A disabled native field is not a trustworthy submission mechanism. Keep
    // the visible field immutable and explicitly send its original value; the
    // server independently preserves and protects the database value.
    const actionData = mode === "edit" && linkedAccount
      ? { ...data, nationalId: defaultValues?.nationalId ?? "" }
      : data;
    const result = mode === "create" ? await createPersonAction(actionData) : await updatePersonAction(personId ?? "", actionData);
    if (!result.success) {
      if (result.error.includes("เหตุผล")) { setError("reason", { message: result.error }); setFocus("reason"); }
      if (result.error.includes("เลขบัตรประชาชน")) setError("nationalId", { message: result.error });
      if (result.error.includes("ชื่อ")) setError(result.error.startsWith("นามสกุล") ? "lastName" : "firstName", { message: result.error });
      if (result.error.includes("เพศ")) setError("gender", { message: result.error });
      if (result.error.includes("วันเกิด")) setError("dateOfBirth", { message: result.error });
      toast.error(mode === "create" ? "เพิ่มข้อมูลประชากรไม่สำเร็จ" : "แก้ไขข้อมูลประชากรไม่สำเร็จ", result.error);
      return;
    }
    toast.success(mode === "create" ? "เพิ่มข้อมูลประชากรสำเร็จ" : "แก้ไขข้อมูลประชากรสำเร็จ");
    router.push(`/admin/population/people/${mode === "create" ? result.id : personId}`);
    router.refresh();
  };

  return <form onSubmit={handleSubmit(submit)} className="space-y-6 rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
    {linkedAccount ? <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">ข้อมูลนี้เชื่อมกับบัญชีผู้ใช้แล้ว สามารถแก้ชื่อและนามสกุลจริงได้เมื่อระบุเหตุผล โดยระบบจะอัปเดตชื่อบัญชีให้ตรงกัน ส่วนเลขบัตรประชาชนและข้อมูลเข้าสู่ระบบยังคงได้รับการป้องกัน</p> : null}
    {movedOut ? <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">บุคคลนี้ย้ายออกจากทะเบียนแล้ว จึงไม่สามารถผูกบ้านหรือกลับเข้าสถานะเดิมจากหน้านี้ได้</p> : null}
    {deceased ? <p className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm leading-6 text-gray-700">บุคคลนี้ถูกบันทึกว่าเสียชีวิตแล้ว สามารถแก้ไขข้อมูลทะเบียนพื้นฐานได้ แต่ไม่สามารถเปลี่ยนบ้านหรือกลับเป็นสถานะอยู่ในทะเบียนจากแบบฟอร์มนี้</p> : null}

    <fieldset className="space-y-4"><legend className="text-sm font-semibold text-gray-900">ข้อมูลระบุตัวตน</legend>
      <div className="grid gap-4 sm:grid-cols-2"><PersonNameInput label="ชื่อ" {...register("firstName", { required: "กรุณาระบุชื่อ", validate: (value) => isValidPersonName(value) || `ชื่อ${NAME_ERROR}` })} error={errors.firstName?.message} required /><PersonNameInput label="นามสกุล" {...register("lastName", { required: "กรุณาระบุนามสกุล", validate: (value) => isValidPersonName(value) || `นามสกุล${NAME_ERROR}` })} error={errors.lastName?.message} required /></div>
      <div className="grid gap-4 sm:grid-cols-2"><ThaiNationalIdInput label="เลขบัตรประชาชน" {...register("nationalId", { validate: (value) => Boolean(linkedAccount) || (mode === "edit" && isSameNationalId(defaultValues?.nationalId ?? "", value)) || !value || (allowNationalIdChecksumBypass ? isThaiNationalIdFormat(value) : isValidStrictThaiNationalId(value)) || "เลขบัตรประชาชนไม่ถูกต้อง" })} error={errors.nationalId?.message} disabled={Boolean(linkedAccount)} helperText={linkedAccount ? "เลขบัตรประชาชนเป็นข้อมูลยืนยันตัวตนและแก้ไขจากหน้านี้ไม่ได้" : "ถ้าระบุ ต้องเป็นเลขบัตรประชาชนไทยที่ถูกต้อง 13 หลัก"} /><Input label="วันเกิด" type="date" max={new Date().toISOString().slice(0, 10)} {...register("dateOfBirth", { validate: (value) => { const result = validateOptionalPersonDate(value); return result.valid || (result.reason === "FUTURE" ? "วันเกิดต้องไม่เป็นวันในอนาคต" : "วันเกิดไม่ถูกต้อง"); } })} error={errors.dateOfBirth?.message} /></div>
      <PersonGenderSelect label="เพศ" {...register("gender", { validate: (value) => PERSON_GENDER_VALUES.includes(value as (typeof PERSON_GENDER_VALUES)[number]) || "ข้อมูลเพศไม่ถูกต้อง" })} error={errors.gender?.message} required />
    </fieldset>

    <fieldset className="space-y-4 border-t border-gray-100 pt-5"><legend className="text-sm font-semibold text-gray-900">ข้อมูลติดต่อ</legend>
      <div className="grid gap-4 sm:grid-cols-2">{linkedAccount ? <Input label="เบอร์เข้าสู่ระบบ" value={linkedAccount.phoneNumber} disabled readOnly helperText="เบอร์นี้ใช้สำหรับเข้าสู่ระบบและต้องเปลี่ยนผ่านขั้นตอนบัญชีผู้ใช้" /> : <ThaiPhoneInput label="เบอร์โทรสำหรับติดต่อ" {...register("phone", { validate: (value) => isValidOptionalThaiPhone(value) || "กรุณาระบุเบอร์โทร 10 หลัก" })} error={errors.phone?.message} />}<Input label="อีเมลสำหรับติดต่อ" type="email" {...register("email")} error={errors.email?.message} helperText={linkedAccount?.email ? `แยกจากอีเมลบัญชี: ${linkedAccount.email}` : "ข้อมูลติดต่อในทะเบียน ไม่ใช้เป็น credential ของบัญชี"} /></div>
    </fieldset>

    <fieldset className="space-y-4 border-t border-gray-100 pt-5"><legend className="text-sm font-semibold text-gray-900">ข้อมูลทะเบียน</legend>
      <Select label={deceased ? "บ้านที่บันทึกล่าสุด" : "บ้านปัจจุบัน"} {...register("houseId")} options={houseOptions} placeholder="ยังไม่ระบุบ้าน" disabled={movedOut || deceased} helperText={movedOut ? "หากกลับมาอยู่ใหม่ ให้ส่งคำขอผูกเลขบ้านใหม่" : deceased ? "เก็บความสัมพันธ์นี้ไว้เพื่อประวัติ ไม่ถือเป็นประชากรที่อยู่ในทะเบียนปัจจุบัน" : ""} />
    </fieldset>

    {mode === "edit" ? <fieldset className="space-y-2 border-t border-gray-100 pt-5"><legend className="text-sm font-semibold text-gray-900">เหตุผลการเปลี่ยนแปลง</legend><Input label="เหตุผล / หมายเหตุการแก้ไข" required={reasonRequired} {...register("reason")} error={errors.reason?.message} maxLength={300} helperText={reasonRequired ? "ข้อมูลสำคัญถูกเปลี่ยน กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร" : "ระบุเมื่อจำเป็น ข้อมูลสำคัญจะบันทึกใน Audit Log"} /></fieldset> : null}
    <div className="flex flex-wrap gap-3 border-t border-gray-100 pt-5"><Button type="submit" className="min-h-11" isLoading={isSubmitting}>{mode === "create" ? "เพิ่มบุคคล" : "บันทึกการแก้ไข"}</Button><Link href={mode === "create" ? "/admin/population/people" : `/admin/population/people/${personId}`} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2">ย้อนกลับ</Link></div>
  </form>;
}
