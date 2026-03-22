"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Trash2, MessageSquare, Lock, Globe } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  adminEditIssueAction,
  adminUpdateStageAction,
  adminDeleteIssueAction,
  adminAddMessageAction,
} from "../actions";

const editSchema = z.object({
  title: z.string().min(5, "หัวข้อต้องมีอย่างน้อย 5 ตัวอักษร"),
  category: z.string().min(1, "กรุณาเลือกหมวดหมู่"),
  priority: z.string().min(1, "กรุณาเลือกระดับความสำคัญ"),
  description: z.string().min(10, "รายละเอียดต้องมีอย่างน้อย 10 ตัวอักษร"),
  location: z.string().optional(),
});

type EditFormData = z.infer<typeof editSchema>;

type AdminEditFormProps = {
  issueId: string;
  defaultValues: EditFormData;
  categoryOptions: { value: string; label: string }[];
  priorityOptions: { value: string; label: string }[];
};

export function AdminEditForm({
  issueId,
  defaultValues,
  categoryOptions,
  priorityOptions,
}: AdminEditFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    defaultValues,
  });

  const onSubmit = async (data: EditFormData) => {
    const result = await adminEditIssueAction(issueId, data);
    if (!result.success) {
      setError("root", { message: result.error });
      return;
    }
    setOpen(false);
    router.refresh();
  };

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        แก้ไขรายละเอียด
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4 border-t border-gray-100 pt-4 mt-4"
    >
      <p className="text-sm font-medium text-gray-700">แก้ไขรายละเอียดคำร้อง</p>
      <Input
        label="หัวข้อปัญหา"
        {...register("title")}
        error={errors.title?.message}
      />
      <div className="grid grid-cols-2 gap-4">
        <Select
          label="หมวดหมู่"
          {...register("category")}
          error={errors.category?.message}
          options={categoryOptions}
        />
        <Select
          label="ระดับความสำคัญ"
          {...register("priority")}
          error={errors.priority?.message}
          options={priorityOptions}
        />
      </div>
      <Textarea
        label="รายละเอียด"
        {...register("description")}
        error={errors.description?.message}
        rows={4}
      />
      <Input label="สถานที่ (ไม่บังคับ)" {...register("location")} />
      {errors.root && <p className="text-sm text-red-600">{errors.root.message}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" isLoading={isSubmitting}>
          บันทึก
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          ยกเลิก
        </Button>
      </div>
    </form>
  );
}

type AdminStageFormProps = {
  issueId: string;
  currentStage: string;
  stageOptions: { value: string; label: string }[];
};

export function AdminStageForm({ issueId, currentStage, stageOptions }: AdminStageFormProps) {
  const router = useRouter();
  const [stage, setStage] = useState(currentStage);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (stage === currentStage) return;
    setIsSubmitting(true);
    setError(null);
    const result = await adminUpdateStageAction(issueId, stage, note);
    if (!result.success) {
      setError(result.error);
      setIsSubmitting(false);
      return;
    }
    setNote("");
    setIsSubmitting(false);
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Select
        label="เปลี่ยนสถานะ"
        value={stage}
        onChange={(e) => setStage(e.target.value)}
        options={stageOptions}
      />
      <Textarea
        label="หมายเหตุ (ไม่บังคับ)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="เช่น ช่างออกไปตรวจสอบแล้ว..."
        rows={2}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <Button
        type="submit"
        size="sm"
        isLoading={isSubmitting}
        disabled={stage === currentStage}
      >
        บันทึกสถานะ
      </Button>
    </form>
  );
}

export function AdminDeleteButton({ issueId }: { issueId: string }) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!confirm("ยืนยันการลบคำร้องนี้? การดำเนินการนี้ไม่สามารถย้อนกลับได้")) return;
    setIsDeleting(true);
    setError(null);
    const result = await adminDeleteIssueAction(issueId);
    if (!result.success) {
      setError(result.error);
      setIsDeleting(false);
      return;
    }
    router.push("/admin/issues");
  };

  return (
    <div>
      <Button variant="danger" size="sm" onClick={handleDelete} isLoading={isDeleting}>
        <Trash2 className="h-4 w-4 mr-1" />
        ลบคำร้อง
      </Button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function AdminMessageForm({ issueId }: { issueId: string }) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setIsSubmitting(true);
    setError(null);
    const result = await adminAddMessageAction(issueId, content, isInternal);
    if (!result.success) {
      setError(result.error);
      setIsSubmitting(false);
      return;
    }
    setContent("");
    setIsSubmitting(false);
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Textarea
        label="เพิ่มข้อความ"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="พิมพ์ข้อความ..."
        rows={3}
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setIsInternal((prev) => !prev)}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            isInternal
              ? "bg-amber-100 text-amber-700 border border-amber-200"
              : "bg-gray-100 text-gray-600 border border-gray-200"
          }`}
        >
          {isInternal ? (
            <>
              <Lock className="h-3 w-3" /> บันทึกภายใน (ไม่เห็นโดยลูกบ้าน)
            </>
          ) : (
            <>
              <Globe className="h-3 w-3" /> ข้อความสาธารณะ (ลูกบ้านเห็น)
            </>
          )}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <Button type="submit" size="sm" isLoading={isSubmitting}>
        <MessageSquare className="h-4 w-4 mr-1" />
        ส่งข้อความ
      </Button>
    </form>
  );
}
