"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createContactAction, updateContactAction } from "./actions";

const schema = z.object({
  name: z.string().min(2, "กรุณาระบุชื่อผู้ติดต่อ"),
  role: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  category: z.string().optional(),
  sortOrder: z.string().optional(),
  isPublic: z.string().min(1, "กรุณาเลือกการมองเห็น"),
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
    sortOrder: string;
    isPublic: string;
  };
};

export function ContactForm({ mode, contactId, defaultValues }: ContactFormProps) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? {
      name: "",
      role: "",
      phone: "",
      email: "",
      address: "",
      category: "",
      sortOrder: "0",
      isPublic: "PUBLIC",
    },
  });

  const onSubmit = async (data: FormData) => {
    if (mode === "create") {
      const result = await createContactAction(data);
      if (!result.success) {
        setError("root", { message: result.error });
        return;
      }
      router.push(`/admin/contacts/${result.id}`);
    } else {
      const result = await updateContactAction(contactId ?? "", data);
      if (!result.success) {
        setError("root", { message: result.error });
        return;
      }
      router.push(`/admin/contacts/${contactId}`);
    }
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <Input label="ชื่อผู้ติดต่อ" {...register("name")} error={errors.name?.message} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="ตำแหน่ง/บทบาท" {...register("role")} error={errors.role?.message} />
        <Input label="หมวดหมู่" {...register("category")} error={errors.category?.message} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="เบอร์โทร" {...register("phone")} error={errors.phone?.message} />
        <Input label="อีเมล" type="email" {...register("email")} error={errors.email?.message} />
      </div>
      <Textarea label="ที่อยู่" {...register("address")} error={errors.address?.message} rows={3} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="ลำดับการแสดงผล"
          {...register("sortOrder")}
          error={errors.sortOrder?.message}
          inputMode="numeric"
        />
        <Select
          label="การมองเห็น"
          {...register("isPublic")}
          options={[
            { value: "PUBLIC", label: "สาธารณะ" },
            { value: "RESIDENT", label: "เฉพาะลูกบ้าน" },
          ]}
          error={errors.isPublic?.message}
        />
      </div>

      {errors.root && <p className="text-sm text-red-600">{errors.root.message}</p>}

      <div className="flex gap-3">
        <Button type="submit" isLoading={isSubmitting}>
          {mode === "create" ? "บันทึกผู้ติดต่อ" : "บันทึกการแก้ไข"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          ย้อนกลับ
        </Button>
      </div>
    </form>
  );
}
