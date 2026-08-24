"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  CONTACT_CATEGORY_OPTIONS,
  CONTACT_PHONE_MAX_LENGTH,
  normalizeContactPhone,
  validateContactPhone,
} from "@/lib/contact";
import { createContactAction, updateContactAction } from "./actions";

const schema = z.object({
  name: z.string().trim().min(2, "กรุณาระบุชื่อผู้ติดต่อ"),
  role: z.string().optional(),
  phone: z.string().refine((value) => !value || !validateContactPhone(value, false), "เบอร์โทรต้องเป็นตัวเลข 3–10 หลัก"),
  email: z.string().optional(),
  address: z.string().optional(),
  category: z.string().optional(),
  isPublic: z.boolean(),
});

type FormData = z.infer<typeof schema>;

type ContactFormProps = {
  mode: "create" | "edit";
  contactId?: string;
  defaultValues?: {
    name: string;
    role: string;
    phone: string;
    email: string;
    address: string;
    category: string;
    isPublic: boolean;
  };
  formId?: string;
  compact?: boolean;
  hideActions?: boolean;
  onCancel?: () => void;
  onSuccess?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onSubmittingChange?: (submitting: boolean) => void;
};

function VisibilitySwitch({ register }: { register: UseFormRegister<FormData> }) {
  return <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-gray-200 px-4 py-3 transition hover:border-gray-300">
    <span><span className="block text-sm font-medium text-gray-900">เผยแพร่สาธารณะ</span><span className="mt-1 block text-xs leading-5 text-gray-500">เมื่อเปิด บุคคลภายนอกสามารถเห็นข้อมูลผู้ติดต่อนี้ได้</span></span>
    <span className="relative mt-0.5 inline-flex shrink-0"><input type="checkbox" className="peer sr-only" {...register("isPublic")} /><span aria-hidden className="h-6 w-11 rounded-full bg-gray-200 transition peer-checked:bg-green-700 peer-focus-visible:ring-2 peer-focus-visible:ring-green-500 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition peer-checked:after:translate-x-5" /></span>
  </label>;
}

export function ContactForm({ mode, contactId, defaultValues, formId, compact = false, hideActions = false, onCancel, onSuccess, onDirtyChange, onSubmittingChange }: ContactFormProps) {
  const router = useRouter();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? { name: "", role: "", phone: "", email: "", address: "", category: "", isPublic: true },
  });

  useEffect(() => onDirtyChange?.(isDirty), [isDirty, onDirtyChange]);
  useEffect(() => onSubmittingChange?.(isSubmitting), [isSubmitting, onSubmittingChange]);

  const onSubmit = async (data: FormData) => {
    try {
      const payload = { ...data, phone: data.phone ? normalizeContactPhone(data.phone) : "", isPublic: data.isPublic ? "PUBLIC" as const : "RESIDENT" as const };
      if (mode === "create") {
        const result = await createContactAction(payload);
        if (!result.success) {
          setError("root", { message: result.error });
          toast.error(result.error);
          return;
        }
        toast.success("เพิ่มผู้ติดต่อเรียบร้อย");
        if (onSuccess) onSuccess(); else router.push(`/admin/contacts/${result.id}`);
        router.refresh();
        return;
      }
      const result = await updateContactAction(contactId ?? "", payload);
      if (!result.success) {
        setError("root", { message: result.error });
        toast.error(result.error);
        return;
      }
      toast.success("บันทึกการแก้ไขเรียบร้อย");
      if (onSuccess) onSuccess(); else router.push(`/admin/contacts/${contactId}`);
      router.refresh();
    } catch (error) {
      console.error("save contact", error);
      const message = "ไม่สามารถบันทึกข้อมูลผู้ติดต่อได้ กรุณาลองใหม่อีกครั้ง";
      setError("root", { message });
      toast.error(message);
    }
  };

  const categoryOptions = defaultValues?.category && !CONTACT_CATEGORY_OPTIONS.some((option) => option.value === defaultValues.category)
    ? [{ value: defaultValues.category, label: `${defaultValues.category} (หมวดหมู่เดิม)` }, ...CONTACT_CATEGORY_OPTIONS]
    : CONTACT_CATEGORY_OPTIONS;

  return (
    <form id={formId} onSubmit={handleSubmit(onSubmit)} className={compact ? "space-y-5" : "space-y-6 rounded-xl border border-gray-200 bg-white p-5 sm:p-6"}>
      <section className="space-y-4">
        {!compact ? <h2 className="text-sm font-semibold text-gray-900">ข้อมูลผู้ติดต่อ</h2> : null}
        <Input label="ชื่อผู้ติดต่อ" {...register("name")} error={errors.name?.message} required />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="ตำแหน่ง/บทบาท" {...register("role")} error={errors.role?.message} />
          <Select label="หมวดหมู่" {...register("category")} options={categoryOptions} placeholder="เลือกหมวดหมู่" error={errors.category?.message} />
        </div>
      </section>
      <section className="space-y-4">
        {!compact ? <h2 className="text-sm font-semibold text-gray-900">ช่องทางติดต่อ</h2> : null}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="เบอร์โทร" inputMode="numeric" maxLength={CONTACT_PHONE_MAX_LENGTH} {...register("phone", { onChange: (event) => setValue("phone", normalizeContactPhone(event.target.value), { shouldDirty: true, shouldValidate: true }) })} error={errors.phone?.message} />
          <Input label="อีเมล" type="email" {...register("email")} error={errors.email?.message} />
        </div>
        <Textarea label="ที่อยู่" {...register("address")} error={errors.address?.message} rows={compact ? 2 : 3} />
      </section>
      <section className="space-y-4">
        {!compact ? <h2 className="text-sm font-semibold text-gray-900">การแสดงผล</h2> : null}
        <VisibilitySwitch register={register} />
      </section>
      {errors.root ? <p className="text-sm text-red-600" role="alert">{errors.root.message}</p> : null}
      {!hideActions ? <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:items-center">
        <Button type="button" variant="outline" onClick={onCancel ?? (() => router.back())} disabled={isSubmitting}>ยกเลิก</Button>
        <Button type="submit" disabled={isSubmitting} isLoading={isSubmitting}>{mode === "create" ? "เพิ่มผู้ติดต่อ" : "บันทึกการแก้ไข"}</Button>
      </div> : null}
    </form>
  );
}
