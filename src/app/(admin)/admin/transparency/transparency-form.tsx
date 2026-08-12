"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { createTransparencyAction, updateTransparencyAction } from "./actions";

const schema = z.object({ title: z.string().min(3, "กรุณาระบุหัวข้อ"), description: z.string().optional(), category: z.string().optional(), amount: z.string().optional(), fiscalYear: z.string().optional(), visibility: z.string().min(1, "กรุณาเลือกการมองเห็น") });
type FormData = z.infer<typeof schema>;
type Props = { mode: "create" | "edit"; transparencyId?: string; defaultValues?: { title: string; description: string; category: string; amount: string; fiscalYear: string; visibility: string } };

export function TransparencyForm({ mode, transparencyId, defaultValues }: Props) {
  const router = useRouter();
  const toast = useToast();
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: defaultValues ?? { title: "", description: "", category: "", amount: "", fiscalYear: "", visibility: "PUBLIC" } });
  const onSubmit = async (data: FormData) => {
    const rawAmount = data.amount?.replace(/,/g, "").trim();
    const amount = rawAmount ? Number(rawAmount) : undefined;
    if (amount !== undefined && (!Number.isFinite(amount) || amount < 0)) { setError("amount", { message: "จำนวนเงินต้องเป็น 0 หรือมากกว่า" }); return; }
    const payload = { ...data, amount };
    if (mode === "create") {
      const result = await createTransparencyAction(payload);
      if (!result.success) { setError("root", { message: result.error }); toast.error("ไม่สามารถบันทึกรายการได้", result.error); return; }
      toast.success("สร้างฉบับร่างเรียบร้อยแล้ว");
      router.push(`/admin/transparency/${result.id}`);
    } else {
      const result = await updateTransparencyAction(transparencyId ?? "", payload);
      if (!result.success) { setError("root", { message: result.error }); toast.error("ไม่สามารถบันทึกรายการได้", result.error); return; }
      toast.success("บันทึกการแก้ไขเรียบร้อยแล้ว");
      router.push(`/admin/transparency/${transparencyId}`);
    }
    router.refresh();
  };
  return <form onSubmit={handleSubmit(onSubmit)} className="space-y-7 rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
    <section className="space-y-4"><div><h2 className="font-semibold text-gray-900">ข้อมูลรายการ</h2><p className="mt-1 text-sm text-gray-500">ระบุรายละเอียดที่ช่วยให้ตรวจสอบข้อมูลได้ชัดเจน</p></div><Input label="หัวข้อ" {...register("title")} error={errors.title?.message} /><Textarea label="รายละเอียด" {...register("description")} error={errors.description?.message} rows={5} /><Input label="หมวดหมู่" {...register("category")} error={errors.category?.message} /></section>
    <section className="space-y-4 border-t border-gray-100 pt-6"><h2 className="font-semibold text-gray-900">ข้อมูลงบประมาณ</h2><div className="grid grid-cols-1 gap-4 md:grid-cols-2"><Input label="จำนวนเงิน (บาท)" {...register("amount")} error={errors.amount?.message} inputMode="decimal" placeholder="เช่น 120,000" /><Input label="ปีงบประมาณ" {...register("fiscalYear")} error={errors.fiscalYear?.message} placeholder="เช่น 2569" /></div></section>
    <section className="space-y-4 border-t border-gray-100 pt-6"><div><h2 className="font-semibold text-gray-900">การมองเห็น</h2><p className="mt-1 text-sm text-gray-500">กำหนดผู้ที่เห็นรายการหลังเผยแพร่</p></div><Select label="การมองเห็น" {...register("visibility")} options={[{ value: "PUBLIC", label: "สาธารณะ" }, { value: "RESIDENT_ONLY", label: "เฉพาะลูกบ้าน" }]} error={errors.visibility?.message} /><p className="text-sm text-gray-500">สาธารณะ: บุคคลทั่วไปสามารถดูรายการนี้จากหน้าหมู่บ้านได้<br />เฉพาะลูกบ้าน: เฉพาะสมาชิกของหมู่บ้านที่มีสิทธิ์เท่านั้นที่ดูได้</p></section>
    {errors.root ? <p className="text-sm text-red-600">{errors.root.message}</p> : null}
    <div className="flex flex-col-reverse gap-3 sm:flex-row"><Button type="button" variant="outline" onClick={() => router.back()}>ยกเลิก</Button><Button type="submit" isLoading={isSubmitting} className="w-full sm:w-auto">{mode === "create" ? "บันทึกฉบับร่าง" : "บันทึกการแก้ไข"}</Button></div>
  </form>;
}
