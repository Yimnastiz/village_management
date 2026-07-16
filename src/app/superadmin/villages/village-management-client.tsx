"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import {
  createVillageAction,
  deleteVillageAction,
  toggleVillageActiveAction,
  updateVillageAction,
} from "./actions";

type VillageRow = {
  id: string;
  name: string;
  slug: string;
  province: string | null;
  district: string | null;
  subdistrict: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  description: string | null;
  isActive: boolean;
  counts: {
    memberships: number;
    houses: number;
    news: number;
  };
};

type DialogState = {
  title: string;
  description: string;
  tone: "default" | "danger";
  action: () => Promise<void>;
} | null;

function TextInput({ name, defaultValue, placeholder }: { name: string; defaultValue?: string | null; placeholder?: string }) {
  return <input name={name} defaultValue={defaultValue ?? ""} placeholder={placeholder} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />;
}

export function CreateVillageForm() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [pending, setPending] = useState(false);

  return (
    <form
      className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        try {
          const formData = new FormData(event.currentTarget);
          await createVillageAction(formData);
          pushToast({ tone: "success", title: "สร้างหมู่บ้านสำเร็จ", description: "ข้อมูลหมู่บ้านใหม่ถูกบันทึกแล้ว" });
          event.currentTarget.reset();
          router.refresh();
        } catch (error) {
          pushToast({ tone: "error", title: "สร้างหมู่บ้านไม่สำเร็จ", description: error instanceof Error ? error.message : "เกิดข้อผิดพลาด" });
        } finally {
          setPending(false);
        }
      }}
    >
      <TextInput name="name" placeholder="ชื่อหมู่บ้าน" />
      <TextInput name="slug" placeholder="slug เช่น banmai" />
      <TextInput name="province" placeholder="จังหวัด" />
      <TextInput name="district" placeholder="อำเภอ" />
      <TextInput name="subdistrict" placeholder="ตำบล" />
      <TextInput name="phone" placeholder="เบอร์โทรติดต่อ" />
      <div className="md:col-span-2">
        <TextInput name="address" placeholder="ที่อยู่" />
      </div>
      <TextInput name="email" placeholder="อีเมล" />
      <div className="md:col-span-2">
        <TextInput name="website" placeholder="เว็บไซต์ (ถ้ามี)" />
      </div>
      <TextInput name="description" placeholder="คำอธิบายหมู่บ้าน" />
      <div className="md:col-span-3">
        <Button type="submit" isLoading={pending} className="bg-cyan-600 hover:bg-cyan-700 focus:ring-cyan-500">
          สร้างหมู่บ้าน
        </Button>
      </div>
    </form>
  );
}

export function VillageCard({ village }: { village: VillageRow }) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [pending, setPending] = useState(false);
  const [dialogState, setDialogState] = useState<DialogState>(null);

  const runAction = async (work: () => Promise<void>, successTitle: string, successDescription: string) => {
    setPending(true);
    try {
      await work();
      pushToast({ tone: "success", title: successTitle, description: successDescription });
      router.refresh();
    } catch (error) {
      pushToast({ tone: "error", title: "ดำเนินการไม่สำเร็จ", description: error instanceof Error ? error.message : "เกิดข้อผิดพลาด" });
    } finally {
      setPending(false);
      setDialogState(null);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href={`/superadmin/villages/${village.id}`} className="text-lg font-semibold text-cyan-800 hover:underline">{village.name}</Link>
          <p className="text-xs text-slate-500">/{village.slug}</p>
        </div>
        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${village.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
          {village.isActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}
        </span>
      </div>

      <p className="mb-3 text-xs text-slate-500">
        สมาชิก {village.counts.memberships} • บ้าน {village.counts.houses} • ข่าว {village.counts.news}
      </p>

      <form
        className="grid grid-cols-1 gap-2 md:grid-cols-3"
        onSubmit={async (event) => {
          event.preventDefault();
          await runAction(
            () => updateVillageAction(new FormData(event.currentTarget)),
            "บันทึกข้อมูลหมู่บ้านแล้ว",
            `อัปเดตข้อมูล ${village.name} สำเร็จ`
          );
        }}
      >
        <input type="hidden" name="id" value={village.id} />
        <TextInput name="name" defaultValue={village.name} />
        <TextInput name="slug" defaultValue={village.slug} />
        <TextInput name="province" defaultValue={village.province} />
        <TextInput name="district" defaultValue={village.district} />
        <TextInput name="subdistrict" defaultValue={village.subdistrict} />
        <TextInput name="phone" defaultValue={village.phone} />
        <div className="md:col-span-2">
          <TextInput name="address" defaultValue={village.address} />
        </div>
        <TextInput name="email" defaultValue={village.email} />
        <div className="md:col-span-2">
          <TextInput name="website" defaultValue={village.website} />
        </div>
        <TextInput name="description" defaultValue={village.description} />
        <div className="md:col-span-3 flex flex-wrap gap-2">
          <Button type="submit" isLoading={pending} variant="secondary">บันทึกข้อมูลหมู่บ้าน</Button>
        </div>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setDialogState({
              title: village.isActive ? "ยืนยันปิดการใช้งานหมู่บ้าน" : "ยืนยันเปิดการใช้งานหมู่บ้าน",
              description: `คุณกำลังจะ${village.isActive ? "ปิด" : "เปิด"}การใช้งาน ${village.name}`,
              tone: "default",
              action: async () => {
                const formData = new FormData();
                formData.set("id", village.id);
                formData.set("nextActive", String(!village.isActive));
                await runAction(
                  () => toggleVillageActiveAction(formData),
                  village.isActive ? "ปิดการใช้งานหมู่บ้านแล้ว" : "เปิดการใช้งานหมู่บ้านแล้ว",
                  village.name
                );
              },
            });
          }}
        >
          {village.isActive ? "ปิดการใช้งาน" : "เปิดการใช้งาน"}
        </Button>
        <Button
          type="button"
          variant="danger"
          onClick={() => {
            setDialogState({
              title: "ยืนยันลบหมู่บ้าน",
              description: `การลบ ${village.name} จะไม่สามารถย้อนกลับได้ หากมีข้อมูลใช้งานอยู่ระบบจะไม่ยอมให้ลบ`,
              tone: "danger",
              action: async () => {
                const formData = new FormData();
                formData.set("id", village.id);
                await runAction(() => deleteVillageAction(formData), "ลบหมู่บ้านแล้ว", village.name);
              },
            });
          }}
        >
          ลบหมู่บ้าน
        </Button>
      </div>

      <ConfirmDialog
        open={Boolean(dialogState)}
        title={dialogState?.title ?? ""}
        description={dialogState?.description}
        tone={dialogState?.tone}
        pending={pending}
        onClose={() => !pending && setDialogState(null)}
        onConfirm={() => {
          void dialogState?.action();
        }}
      />
    </div>
  );
}
