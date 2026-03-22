"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { NEWS_VISIBILITY_LABELS, TRANSPARENCY_STAGE_LABELS } from "@/lib/constants";
import { createTransparencyAction, updateTransparencyAction } from "./actions";

const schema = z.object({
  title: z.string().min(3, "กรุณาระบุหัวข้อ"),
  description: z.string().optional(),
  category: z.string().optional(),
  amount: z.string().optional(),
  fiscalYear: z.string().optional(),
  stage: z.string().min(1, "กรุณาเลือกสถานะ"),
  visibility: z.string().min(1, "กรุณาเลือกการมองเห็น"),
});

type FormData = z.infer<typeof schema>;

type TransparencyFormProps = {
  mode: "create" | "edit";
  transparencyId?: string;
  defaultValues?: {
    title: string;
    description: string;
    category: string;
    amount: string;
    fiscalYear: string;
    stage: string;
    visibility: string;
  };
};

export function TransparencyForm({ mode, transparencyId, defaultValues }: TransparencyFormProps) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? {
      title: "",
      description: "",
      category: "",
      amount: "",
      fiscalYear: "",
      stage: "DRAFT",
      visibility: "PUBLIC",
    },
  });

  const stageOptions = Object.entries(TRANSPARENCY_STAGE_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  const visibilityOptions = Object.entries(NEWS_VISIBILITY_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  const onSubmit = async (data: FormData) => {
    const amountRaw = data.amount?.trim();
    const amount = amountRaw && amountRaw.length > 0 ? Number(amountRaw) : undefined;

    if (amount !== undefined && (Number.isNaN(amount) || amount < 0)) {
      setError("amount", { message: "จำนวนเงินไม่ถูกต้อง" });
      return;
    }

    const payload = {
      title: data.title,
      description: data.description,
      category: data.category,
      amount,
      fiscalYear: data.fiscalYear,
      stage: data.stage,
      visibility: data.visibility,
    };

    if (mode === "create") {
      const result = await createTransparencyAction(payload);
      if (!result.success) {
        setError("root", { message: result.error });
        return;
      }
      router.push(`/admin/transparency/${result.id}`);
    } else {
      const result = await updateTransparencyAction(transparencyId ?? "", payload);
      if (!result.success) {
        setError("root", { message: result.error });
        return;
      }
      router.push(`/admin/transparency/${transparencyId}`);
    }
    router.refresh();
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="bg-white rounded-xl border border-gray-200 p-6 space-y-4"
    >
      <Input label="หัวข้อ" {...register("title")} error={errors.title?.message} />
      <Textarea
        label="รายละเอียด"
        {...register("description")}
        error={errors.description?.message}
        rows={5}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="หมวดหมู่" {...register("category")} error={errors.category?.message} />
        <Input
          label="จำนวนเงิน"
          {...register("amount")}
          error={errors.amount?.message}
          inputMode="decimal"
          placeholder="เช่น 120000"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input
          label="ปีงบประมาณ"
          {...register("fiscalYear")}
          error={errors.fiscalYear?.message}
          placeholder="เช่น 2569"
        />
        <Select
          label="สถานะ"
          {...register("stage")}
          options={stageOptions}
          error={errors.stage?.message}
        />
        <Select
          label="การมองเห็น"
          {...register("visibility")}
          options={visibilityOptions}
          error={errors.visibility?.message}
        />
      </div>

      {errors.root && <p className="text-sm text-red-600">{errors.root.message}</p>}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" isLoading={isSubmitting}>
          {mode === "create" ? "บันทึกรายการ" : "บันทึกการแก้ไข"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          ย้อนกลับ
        </Button>
      </div>
    </form>
  );
}
