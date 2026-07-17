"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select } from "@/components/ui/select";
import { SuggestCombobox } from "@/components/ui/suggest-combobox";
import { useToast } from "@/components/ui/toast";
import type { ThaiProvince } from "@/lib/thai-geography";
import { normalizeVillageSlug } from "@/lib/village-slug";
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

type VillageFormState = {
  name: string;
  slug: string;
  province: string;
  district: string;
  subdistrict: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  description: string;
  isActive: string;
};

type DialogState = {
  title: string;
  description: string;
  tone: "default" | "danger";
  action: () => Promise<void>;
} | null;

const emptyForm: VillageFormState = {
  name: "",
  slug: "",
  province: "",
  district: "",
  subdistrict: "",
  address: "",
  phone: "",
  email: "",
  website: "",
  description: "",
  isActive: "true",
};

function villageToForm(village: VillageRow): VillageFormState {
  return {
    name: village.name,
    slug: village.slug,
    province: village.province ?? "",
    district: village.district ?? "",
    subdistrict: village.subdistrict ?? "",
    address: village.address ?? "",
    phone: village.phone ?? "",
    email: village.email ?? "",
    website: village.website ?? "",
    description: village.description ?? "",
    isActive: String(village.isActive),
  };
}

function areaLine(village: Pick<VillageRow, "subdistrict" | "district" | "province">) {
  const parts = [
    village.subdistrict ? `ต.${village.subdistrict}` : "ยังไม่มีข้อมูลตำบล",
    village.district ? `อ.${village.district}` : "ยังไม่มีข้อมูลอำเภอ",
    village.province ? `จ.${village.province}` : "ยังไม่มีข้อมูลจังหวัด",
  ];
  return parts.join(" · ");
}

function muted(value: string | null | undefined, fallback: string) {
  return value ? value : fallback;
}

function TextField({
  label,
  name,
  value,
  placeholder,
  error,
  type = "text",
  onChange,
  onBlur,
}: {
  label: string;
  name: keyof VillageFormState;
  value: string;
  placeholder: string;
  error?: string;
  type?: string;
  onChange: (name: keyof VillageFormState, value: string) => void;
  onBlur?: () => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        value={value}
        type={type}
        placeholder={placeholder}
        onBlur={onBlur}
        onChange={(event) => onChange(name, event.target.value)}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-cyan-500"
      />
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

function validateForm(values: VillageFormState, thaiGeography: ThaiProvince[]) {
  const errors: Partial<Record<keyof VillageFormState, string>> = {};
  if (!values.name.trim()) errors.name = "กรุณากรอกชื่อหมู่บ้าน";
  if (!normalizeVillageSlug(values.slug || values.name)) errors.slug = "กรุณากรอก Slug";

  const province = thaiGeography.find((item) => item.name === values.province);
  if (!province) errors.province = "เลือกจังหวัดจากรายการ";

  const district = province?.districts.find((item) => item.name === values.district);
  if (!district) errors.district = "เลือกอำเภอที่สัมพันธ์กับจังหวัด";

  if (!district?.subdistricts.includes(values.subdistrict)) {
    errors.subdistrict = "เลือกตำบลที่สัมพันธ์กับอำเภอ";
  }

  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    errors.email = "อีเมลไม่ถูกต้อง";
  }

  if (values.website) {
    try {
      const candidate = /^https?:\/\//i.test(values.website) ? values.website : `https://${values.website}`;
      const url = new URL(candidate);
      if (!["http:", "https:"].includes(url.protocol)) errors.website = "เว็บไซต์ต้องเป็น http หรือ https";
    } catch {
      errors.website = "เว็บไซต์ไม่ถูกต้อง";
    }
  }

  return errors;
}

function VillageForm({
  mode,
  initialValues,
  thaiGeography,
  pending,
  onSubmit,
}: {
  mode: "create" | "edit";
  initialValues: VillageFormState;
  thaiGeography: ThaiProvince[];
  pending: boolean;
  onSubmit: (formData: FormData, reset: () => void) => Promise<void>;
}) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof VillageFormState, string>>>({});

  const selectedProvince = useMemo(
    () => thaiGeography.find((item) => item.name === values.province) ?? null,
    [thaiGeography, values.province]
  );
  const selectedDistrict = useMemo(
    () => selectedProvince?.districts.find((item) => item.name === values.district) ?? null,
    [selectedProvince, values.district]
  );
  const provinceOptions = useMemo(() => thaiGeography.map((item) => ({ value: item.name, label: item.name })), [thaiGeography]);
  const districtOptions = useMemo(() => (selectedProvince?.districts ?? []).map((item) => ({ value: item.name, label: item.name })), [selectedProvince]);
  const subdistrictOptions = useMemo(() => (selectedDistrict?.subdistricts ?? []).map((item) => ({ value: item, label: item })), [selectedDistrict]);

  const update = (name: keyof VillageFormState, value: string) => {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  const reset = () => {
    setValues(emptyForm);
    setErrors({});
  };

  return (
    <form
      className="mt-4 space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        const nextValues = { ...values, slug: normalizeVillageSlug(values.slug || values.name) };
        const nextErrors = validateForm(nextValues, thaiGeography);
        setValues(nextValues);
        setErrors(nextErrors);
        if (Object.values(nextErrors).some(Boolean)) return;

        const formData = new FormData();
        Object.entries(nextValues).forEach(([key, value]) => formData.set(key, value));
        await onSubmit(formData, reset);
      }}
    >
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">ข้อมูลพื้นฐาน</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <TextField label="ชื่อหมู่บ้าน" name="name" value={values.name} placeholder="ชื่อหมู่บ้าน" error={errors.name} onChange={update} />
          <TextField
            label="Slug"
            name="slug"
            value={values.slug}
            placeholder="Slug"
            error={errors.slug}
            onChange={update}
            onBlur={() => update("slug", normalizeVillageSlug(values.slug || values.name))}
          />
          {mode === "create" ? (
            <Select
              label="สถานะ"
              value={values.isActive}
              onChange={(event) => update("isActive", event.target.value)}
              options={[
                { value: "true", label: "เปิดใช้งาน" },
                { value: "false", label: "ปิดใช้งาน" },
              ]}
            />
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">ที่ตั้ง</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <SuggestCombobox
            id={`${mode}-province-${initialValues.slug || "new"}`}
            label="จังหวัด"
            value={values.province}
            options={provinceOptions}
            placeholder="จังหวัด"
            error={errors.province}
            emptyMessage="ไม่พบข้อมูลจังหวัด"
            onChange={(value) => {
              setValues((current) => ({ ...current, province: value, district: "", subdistrict: "" }));
              setErrors((current) => ({ ...current, province: undefined, district: undefined, subdistrict: undefined }));
            }}
          />
          <SuggestCombobox
            id={`${mode}-district-${initialValues.slug || "new"}`}
            label="อำเภอ"
            value={values.district}
            options={districtOptions}
            placeholder={values.province ? "อำเภอ" : "เลือกจังหวัดก่อน"}
            disabled={!values.province}
            error={errors.district}
            emptyMessage="ไม่พบข้อมูลอำเภอ"
            onChange={(value) => {
              setValues((current) => ({ ...current, district: value, subdistrict: "" }));
              setErrors((current) => ({ ...current, district: undefined, subdistrict: undefined }));
            }}
          />
          <SuggestCombobox
            id={`${mode}-subdistrict-${initialValues.slug || "new"}`}
            label="ตำบล"
            value={values.subdistrict}
            options={subdistrictOptions}
            placeholder={values.district ? "ตำบล" : "เลือกอำเภอก่อน"}
            disabled={!values.district}
            error={errors.subdistrict}
            emptyMessage="ไม่พบข้อมูลตำบล"
            onChange={(value) => update("subdistrict", value)}
          />
        </div>
        <TextField label="ที่อยู่เพิ่มเติม" name="address" value={values.address} placeholder="ที่อยู่" onChange={update} />
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">ช่องทางติดต่อ</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <TextField label="อีเมล" name="email" value={values.email} placeholder="อีเมล" type="email" error={errors.email} onChange={update} />
          <TextField label="เบอร์โทร" name="phone" value={values.phone} placeholder="เบอร์โทร" onChange={update} />
          <TextField label="เว็บไซต์" name="website" value={values.website} placeholder="เว็บไซต์" error={errors.website} onChange={update} />
        </div>
        <TextField label="รายละเอียดเพิ่มเติม" name="description" value={values.description} placeholder="รายละเอียดเพิ่มเติม" onChange={update} />
      </section>

      <Button type="submit" isLoading={pending} className="bg-cyan-600 hover:bg-cyan-700 focus:ring-cyan-500">
        {mode === "create" ? "สร้างหมู่บ้าน" : "บันทึกข้อมูลหมู่บ้าน"}
      </Button>
    </form>
  );
}

export function VillageSearchForm({
  keyword,
  status,
  province,
  thaiGeography,
}: {
  keyword: string;
  status: string;
  province: string;
  thaiGeography: ThaiProvince[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(keyword);
  const [selectedStatus, setSelectedStatus] = useState(status);
  const [selectedProvince, setSelectedProvince] = useState(province);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (q.trim()) params.set("q", q.trim());
      else params.delete("q");

      if (selectedStatus !== "all") params.set("status", selectedStatus);
      else params.delete("status");

      if (selectedProvince) params.set("province", selectedProvince);
      else params.delete("province");
      params.delete("page");
      router.replace(`${pathname}?${params.toString()}`);
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [pathname, q, router, searchParams, selectedProvince, selectedStatus]);

  return (
    <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4">
      <div className="md:col-span-2">
        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="village-search">ค้นหา</label>
        <input
          id="village-search"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="ค้นหาชื่อหมู่บ้าน / slug / ตำบล / อำเภอ / จังหวัด"
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-cyan-500"
        />
      </div>
      <Select
        label="สถานะ"
        value={selectedStatus}
        onChange={(event) => setSelectedStatus(event.target.value)}
        options={[
          { value: "all", label: "ทุกสถานะ" },
          { value: "active", label: "เปิดใช้งาน" },
          { value: "inactive", label: "ปิดใช้งาน" },
        ]}
      />
      <SuggestCombobox
        id="village-filter-province"
        label="จังหวัด"
        value={selectedProvince}
        options={thaiGeography.map((item) => ({ value: item.name, label: item.name }))}
        placeholder="ทุกจังหวัด"
        emptyMessage="ไม่พบข้อมูลจังหวัด"
        onChange={setSelectedProvince}
      />
      <div className="md:col-span-4">
        <Link href="/superadmin/villages" className="inline-flex rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          ล้างตัวกรอง
        </Link>
      </div>
    </div>
  );
}

export function CreateVillageForm({ thaiGeography }: { thaiGeography: ThaiProvince[] }) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [pending, setPending] = useState(false);

  return (
    <VillageForm
      mode="create"
      initialValues={emptyForm}
      thaiGeography={thaiGeography}
      pending={pending}
      onSubmit={async (formData, reset) => {
        setPending(true);
        try {
          await createVillageAction(formData);
          pushToast({ tone: "success", title: "สร้างหมู่บ้านสำเร็จ", description: "ข้อมูลหมู่บ้านใหม่ถูกบันทึกแล้ว" });
          reset();
          router.refresh();
        } catch (error) {
          pushToast({ tone: "error", title: "สร้างหมู่บ้านไม่สำเร็จ", description: error instanceof Error ? error.message : "เกิดข้อผิดพลาด" });
        } finally {
          setPending(false);
        }
      }}
    />
  );
}

export function VillageCard({ village, thaiGeography }: { village: VillageRow; thaiGeography: ThaiProvince[] }) {
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
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/superadmin/villages/${village.id}`} className="text-lg font-semibold text-cyan-800 hover:underline">
            {village.name}
          </Link>
          <p className="mt-1 text-sm text-slate-600">{areaLine(village)}</p>
          <p className="mt-1 text-xs text-slate-500">/{village.slug}</p>
        </div>
        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${village.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
          {village.isActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}
        </span>
      </div>

      <div className="mb-4 grid gap-2 text-sm text-slate-600 md:grid-cols-3">
        <p>สมาชิก {village.counts.memberships}</p>
        <p>บ้าน {village.counts.houses}</p>
        <p>ข่าว {village.counts.news}</p>
        <p className={village.address ? "" : "text-slate-400"}>{muted(village.address, "ยังไม่มีที่อยู่")}</p>
        <p className={village.email ? "" : "text-slate-400"}>{muted(village.email, "ยังไม่มีอีเมล")}</p>
        <p className={village.phone ? "" : "text-slate-400"}>{muted(village.phone, "ยังไม่มีเบอร์โทร")}</p>
        <p className={village.website ? "" : "text-slate-400"}>{muted(village.website, "ยังไม่มีเว็บไซต์")}</p>
        <p className={`md:col-span-3 ${village.description ? "" : "text-slate-400"}`}>{muted(village.description, "ยังไม่มีคำอธิบาย")}</p>
      </div>

      <VillageForm
        mode="edit"
        initialValues={villageToForm(village)}
        thaiGeography={thaiGeography}
        pending={pending}
        onSubmit={async (formData) => {
          formData.set("id", village.id);
          await runAction(
            () => updateVillageAction(formData),
            "บันทึกข้อมูลหมู่บ้านแล้ว",
            `อัปเดตข้อมูล ${village.name} สำเร็จ`
          );
        }}
      />

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setDialogState({
              title: village.isActive ? "ยืนยันปิดการใช้งานหมู่บ้าน" : "ยืนยันเปิดการใช้งานหมู่บ้าน",
              description: `${village.name}\n${areaLine(village)}\nผลกระทบ: ${village.isActive ? "ผู้ใช้จะไม่เห็นหมู่บ้านนี้เป็นหมู่บ้านที่เปิดใช้งาน" : "หมู่บ้านนี้จะกลับมาเปิดใช้งาน"}`,
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
              description: `${village.name}\n${areaLine(village)}\nผลกระทบ: ระบบจะปฏิเสธการลบถ้ามี Membership, บ้าน, คำขอ, ข่าว, ผู้ติดต่อ, สถานที่, กิจกรรม, ความโปร่งใส หรือ Audit history อยู่`,
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
