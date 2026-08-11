"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { PERSON_STATUS_LABELS } from "@/lib/constants";
import type { VillagePersonInput } from "@/features/population/server/village-population-service";

type Result = { success: true; id?: string; message: string } | { success: false; error: string };
export function VillagePersonForm({ action, mode, houseOptions, defaultValues, successHref }: { action: (data: VillagePersonInput) => Promise<Result>; mode: "create"|"edit"; houseOptions: {value:string;label:string}[]; defaultValues?: VillagePersonInput; successHref: (id?: string) => string }) {
  const router = useRouter(); const toast = useToast();
  const { register, handleSubmit, setError, formState:{errors,isSubmitting} } = useForm<VillagePersonInput>({ defaultValues: defaultValues ?? {firstName:"",lastName:"",nationalId:"",dateOfBirth:"",gender:"",phone:"",email:"",status:"ACTIVE",houseId:""} });
  return <form onSubmit={handleSubmit(async data => { const result=await action(data); if(!result.success){setError("root",{message:result.error});toast.error(mode==="create"?"เพิ่มประชากรไม่สำเร็จ":"แก้ไขข้อมูลประชากรไม่สำเร็จ",result.error);return;} toast.success(result.message); router.push(successHref(result.id)); router.refresh(); })} className="space-y-5 rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
    <div className="grid gap-4 sm:grid-cols-2"><Input label="ชื่อ" required {...register("firstName")}/><Input label="นามสกุล" required {...register("lastName")}/></div>
    <div className="grid gap-4 sm:grid-cols-2"><Input label="เลขบัตรประชาชน" inputMode="numeric" maxLength={13} {...register("nationalId")}/><Input label="วันเกิด" type="date" {...register("dateOfBirth")}/></div>
    <div className="grid gap-4 sm:grid-cols-2"><Input label="เพศ" {...register("gender")}/><Input label="เบอร์โทร" {...register("phone")}/></div>
    <div className="grid gap-4 sm:grid-cols-2"><Input label="อีเมล" type="email" {...register("email")}/><Select label="สถานะ" {...register("status")} options={Object.entries(PERSON_STATUS_LABELS).map(([value,label])=>({value,label}))}/></div>
    <Select label="บ้านที่ผูก" {...register("houseId")} options={houseOptions} placeholder="ไม่ผูกกับบ้าน" helperText="แสดงเฉพาะบ้านในหมู่บ้านเป้าหมาย"/>
    {errors.root?.message ? <p className="text-sm text-rose-600">{errors.root.message}</p>:null}
    <div className="flex flex-wrap gap-2"><Button type="submit" isLoading={isSubmitting}>{mode==="create"?"เพิ่มประชากร":"บันทึกการแก้ไข"}</Button><Button type="button" variant="outline" onClick={()=>router.back()}>ยกเลิก</Button></div>
  </form>;
}
