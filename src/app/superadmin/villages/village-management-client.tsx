"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ExternalLink, Pencil, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SuggestCombobox } from "@/components/ui/suggest-combobox";
import { useToast } from "@/components/ui/toast";
import type { ThaiProvince } from "@/lib/thai-geography";
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

type VillageFormValues = {
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
};

type FieldErrors = Partial<Record<keyof VillageFormValues, string>>;

type DialogState = {
  title: string;
  description: string;
  tone: "default" | "danger";
  action: () => Promise<void>;
} | null;

const emptyVillageForm: VillageFormValues = {
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
};

function toOptions(values: string[]) {
  return values.map((value) => ({ value }));
}

function muted(value: string | null | undefined, fallback: string) {
  return value?.trim() ? value : fallback;
}

function isExactOption(value: string, options: { value: string }[]) {
  return options.some((option) => option.value === value.trim());
}

function locationLine(village: VillageRow) {
  return [
    village.subdistrict ? `ต.${village.subdistrict}` : "ยังไม่มีข้อมูลตำบล",
    village.district ? `อ.${village.district}` : "ยังไม่มีข้อมูลอำเภอ",
    village.province ? `จ.${village.province}` : "ยังไม่มีข้อมูลจังหวัด",
  ];
}

function FormField({
  label,
  name,
  value,
  placeholder,
  error,
  type = "text",
  onChange,
}: {
  label: string;
  name: keyof VillageFormValues;
  value: string;
  placeholder: string;
  error?: string;
  type?: string;
  onChange: (name: keyof VillageFormValues, value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(name, event.target.value)}
        className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-green-500 ${
          error ? "border-red-300 bg-red-50" : "border-slate-300 bg-white"
        }`}
      />
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

function FormTextarea({
  label,
  name,
  value,
  placeholder,
  error,
  onChange,
}: {
  label: string;
  name: keyof VillageFormValues;
  value: string;
  placeholder: string;
  error?: string;
  onChange: (name: keyof VillageFormValues, value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        value={value}
        rows={3}
        placeholder={placeholder}
        onChange={(event) => onChange(name, event.target.value)}
        className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-green-500 ${
          error ? "border-red-300 bg-red-50" : "border-slate-300 bg-white"
        }`}
      />
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

function VillageFormModal({
  open,
  mode,
  title,
  geography,
  initialValues,
  statusLabel,
  pending,
  serverError,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit";
  title: string;
  geography: ThaiProvince[];
  initialValues: VillageFormValues;
  statusLabel: string;
  pending: boolean;
  serverError?: string;
  onClose: () => void;
  onSubmit: (values: VillageFormValues) => Promise<void>;
}) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<FieldErrors>({});

  const provinceOptions = useMemo(() => toOptions(geography.map((province) => province.name)), [geography]);
  const selectedProvince = geography.find((province) => province.name === values.province);
  const districtOptions = useMemo(
    () => toOptions(selectedProvince?.districts.map((district) => district.name) ?? []),
    [selectedProvince]
  );
  const selectedDistrict = selectedProvince?.districts.find((district) => district.name === values.district);
  const subdistrictOptions = useMemo(() => toOptions(selectedDistrict?.subdistricts ?? []), [selectedDistrict]);

  if (!open) {
    return null;
  }

  const setField = (name: keyof VillageFormValues, value: string) => {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  const validateClient = () => {
    const nextErrors: FieldErrors = {};

    if (!values.name.trim()) {
      nextErrors.name = "กรุณากรอกชื่อหมู่บ้าน";
    }
    if (!values.slug.trim()) {
      nextErrors.slug = "กรุณากรอก slug";
    }
    if (!isExactOption(values.province, provinceOptions)) {
      nextErrors.province = "กรุณาเลือกจากรายการที่ระบบแนะนำ";
    }
    if (!isExactOption(values.district, districtOptions)) {
      nextErrors.district = "กรุณาเลือกจากรายการที่ระบบแนะนำ";
    }
    if (!isExactOption(values.subdistrict, subdistrictOptions)) {
      nextErrors.subdistrict = "กรุณาเลือกจากรายการที่ระบบแนะนำ";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || !validateClient()) {
      return;
    }
    await onSubmit(values);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:max-w-4xl sm:rounded-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            {serverError ? <p className="mt-1 text-sm text-red-600">{serverError}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label="ปิด"
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto px-4 py-4 sm:px-6">
          <div className="space-y-6">
            <section>
              <h3 className="mb-3 text-sm font-semibold text-slate-900">ข้อมูลพื้นฐาน</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <FormField label="ชื่อหมู่บ้าน" name="name" value={values.name} placeholder="ชื่อหมู่บ้าน" error={errors.name} onChange={setField} />
                <FormField label="Slug" name="slug" value={values.slug} placeholder="ban-mai หรือ บ้านใหม่" error={errors.slug} onChange={setField} />
                <div>
                  <label htmlFor={`${mode}-status`} className="mb-1 block text-sm font-medium text-slate-700">
                    สถานะ
                  </label>
                  <input
                    id={`${mode}-status`}
                    value={statusLabel}
                    disabled
                    className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
                  />
                </div>
                <FormField label="คำอธิบาย" name="description" value={values.description} placeholder="คำอธิบายหมู่บ้าน" error={errors.description} onChange={setField} />
              </div>
            </section>

            <section>
              <h3 className="mb-3 text-sm font-semibold text-slate-900">ที่ตั้ง</h3>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                <div>
                  <SuggestCombobox
                    id={`${mode}-province`}
                    label="จังหวัด"
                    value={values.province}
                    options={provinceOptions}
                    placeholder="เลือกจังหวัด"
                    emptyMessage="ไม่พบข้อมูลใน GeoThai"
                    error={errors.province}
                    onChange={(value) => {
                      setValues((current) => ({ ...current, province: value, district: "", subdistrict: "" }));
                      setErrors((current) => ({ ...current, province: undefined, district: undefined, subdistrict: undefined }));
                    }}
                  />
                  <input type="hidden" name="province" value={values.province} />
                </div>
                <div>
                  <SuggestCombobox
                    id={`${mode}-district`}
                    label="อำเภอ"
                    value={values.district}
                    options={districtOptions}
                    placeholder={values.province ? "เลือกอำเภอ" : "เลือกจังหวัดก่อน"}
                    disabled={!isExactOption(values.province, provinceOptions)}
                    emptyMessage="ไม่พบข้อมูลใน GeoThai"
                    error={errors.district}
                    onChange={(value) => {
                      setValues((current) => ({ ...current, district: value, subdistrict: "" }));
                      setErrors((current) => ({ ...current, district: undefined, subdistrict: undefined }));
                    }}
                  />
                  <input type="hidden" name="district" value={values.district} />
                </div>
                <div>
                  <SuggestCombobox
                    id={`${mode}-subdistrict`}
                    label="ตำบล"
                    value={values.subdistrict}
                    options={subdistrictOptions}
                    placeholder={values.district ? "เลือกตำบล" : "เลือกอำเภอก่อน"}
                    disabled={!isExactOption(values.district, districtOptions)}
                    emptyMessage="ไม่พบข้อมูลใน GeoThai"
                    error={errors.subdistrict}
                    onChange={(value) => setField("subdistrict", value)}
                  />
                  <input type="hidden" name="subdistrict" value={values.subdistrict} />
                </div>
              </div>
              <div className="mt-3">
                <FormTextarea label="ที่อยู่เพิ่มเติม" name="address" value={values.address} placeholder="ที่อยู่เพิ่มเติมของหมู่บ้าน" error={errors.address} onChange={setField} />
              </div>
            </section>

            <section>
              <h3 className="mb-3 text-sm font-semibold text-slate-900">ช่องทางติดต่อ</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <FormField label="อีเมล" name="email" type="email" value={values.email} placeholder="อีเมล" error={errors.email} onChange={setField} />
                <FormField label="เบอร์โทร" name="phone" value={values.phone} placeholder="เบอร์โทร" error={errors.phone} onChange={setField} />
                <FormField label="เว็บไซต์" name="website" type="url" value={values.website} placeholder="https://example.com" error={errors.website} onChange={setField} />
              </div>
            </section>
          </div>

          <div className="sticky bottom-0 -mx-4 mt-6 flex justify-end gap-2 border-t border-slate-200 bg-white px-4 py-3 sm:-mx-6 sm:px-6">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              ยกเลิก
            </Button>
            <Button type="submit" isLoading={pending}>
              {mode === "create" ? "เพิ่มหมู่บ้าน" : "บันทึก"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function VillagesToolbar({
  geography,
  initialQuery,
  initialStatus,
  initialProvince,
}: {
  geography: ThaiProvince[];
  initialQuery: string;
  initialStatus: string;
  initialProvince: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { pushToast } = useToast();
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState(initialStatus || "all");
  const [province, setProvince] = useState(initialProvince);
  const [createOpen, setCreateOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [serverError, setServerError] = useState("");

  useEffect(() => {
    setQuery(initialQuery);
    setStatus(initialStatus || "all");
    setProvince(initialProvince);
  }, [initialProvince, initialQuery, initialStatus]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (status !== "all") params.set("status", status);
      if (province.trim()) params.set("province", province.trim());
      const href = params.toString() ? `${pathname}?${params.toString()}` : pathname;
      router.replace(href);
    }, 400);

    return () => window.clearTimeout(timer);
  }, [pathname, province, query, router, status]);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (status !== "all") params.set("status", status);
    if (province.trim()) params.set("province", province.trim());
    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">จัดการหมู่บ้าน</h1>
          <p className="mt-1 text-sm text-slate-600">ค้นหาและจัดการข้อมูลหมู่บ้านจากศูนย์กลาง</p>
        </div>
        <Button
          type="button"
          onClick={() => {
            setServerError("");
            setCreateOpen(true);
          }}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          เพิ่มหมู่บ้าน
        </Button>
      </div>

      <form onSubmit={submitSearch} className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-4">
        <label className="md:col-span-2">
          <span className="mb-1 block text-sm font-medium text-slate-700">ค้นหา</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ชื่อหมู่บ้าน / slug / ตำบล / อำเภอ / จังหวัด"
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </label>
        <label>
          <span className="mb-1 block text-sm font-medium text-slate-700">สถานะ</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="all">ทุกสถานะ</option>
            <option value="active">เปิดใช้งาน</option>
            <option value="inactive">ปิดใช้งาน</option>
          </select>
        </label>
        <label>
          <span className="mb-1 block text-sm font-medium text-slate-700">จังหวัด</span>
          <select
            value={province}
            onChange={(event) => setProvince(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">ทุกจังหวัด</option>
            {geography.map((item) => (
              <option key={item.name} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-2 md:col-span-4">
          <Button type="submit" variant="secondary" className="gap-2">
            <Search className="h-4 w-4" />
            ค้นหา
          </Button>
          <Link href="/superadmin/villages" className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            ล้างตัวกรอง
          </Link>
        </div>
      </form>

      {createOpen ? (
        <VillageFormModal
          open={createOpen}
          mode="create"
          title="เพิ่มหมู่บ้านใหม่"
          geography={geography}
          initialValues={emptyVillageForm}
          statusLabel="เปิดใช้งาน"
          pending={pending}
          serverError={serverError}
          onClose={() => {
            if (!pending) setCreateOpen(false);
          }}
          onSubmit={async (values) => {
            setPending(true);
            setServerError("");
            try {
              const formData = new FormData();
              Object.entries(values).forEach(([key, value]) => formData.set(key, value));
              await createVillageAction(formData);
              pushToast({ tone: "success", title: "สร้างหมู่บ้านสำเร็จ", description: "บันทึกข้อมูลหมู่บ้านใหม่แล้ว" });
              setCreateOpen(false);
              router.refresh();
            } catch (error) {
              const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาด";
              setServerError(message);
              pushToast({ tone: "error", title: "สร้างหมู่บ้านไม่สำเร็จ", description: message });
            } finally {
              setPending(false);
            }
          }}
        />
      ) : null}
    </div>
  );
}

function villageToFormValues(village: VillageRow): VillageFormValues {
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
  };
}

function DetailValue({ label, value, fallback }: { label: string; value: string | null; fallback: string }) {
  const hasValue = Boolean(value?.trim());
  return (
    <div>
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`mt-0.5 text-sm ${hasValue ? "text-slate-800" : "text-muted-foreground"}`}>
        {muted(value, fallback)}
      </div>
    </div>
  );
}

export function VillageCard({ village, geography }: { village: VillageRow; geography: ThaiProvince[] }) {
  const router = useRouter();
  const { pushToast } = useToast();
  const [pending, setPending] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [serverError, setServerError] = useState("");
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const placeParts = locationLine(village);

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
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link href={`/superadmin/villages/${village.id}`} className="text-lg font-semibold text-slate-900 hover:text-green-700 hover:underline">
            {village.name}
          </Link>
          <p className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-sm text-slate-600">
            {placeParts.map((part) => (
              <span key={part} className={part.startsWith("ยังไม่มี") ? "text-muted-foreground" : ""}>
                {part}
              </span>
            ))}
          </p>
          <p className="mt-1 text-xs text-slate-500">/{village.slug}</p>
        </div>
        <span className={`w-fit rounded-full px-2 py-1 text-xs font-semibold ${village.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
          {village.isActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <DetailValue label="อีเมล" value={village.email} fallback="ยังไม่มีอีเมล" />
        <DetailValue label="เบอร์โทร" value={village.phone} fallback="ยังไม่มีเบอร์โทร" />
        <DetailValue label="เว็บไซต์" value={village.website} fallback="ยังไม่มีเว็บไซต์" />
        <DetailValue label="ที่อยู่" value={village.address} fallback="ยังไม่มีที่อยู่" />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <Link
          href={`/superadmin/villages/${village.id}`}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          <ExternalLink className="h-4 w-4" />
          เข้า Workspace
        </Link>
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={() => {
            setServerError("");
            setEditOpen(true);
          }}
        >
          <Pencil className="h-4 w-4" />
          แก้ไข
        </Button>
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
          {village.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
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
          ลบ
        </Button>
        <span className="ml-auto text-xs text-slate-500">
          สมาชิก {village.counts.memberships} · บ้าน {village.counts.houses} · ข่าว {village.counts.news}
        </span>
      </div>

      {editOpen ? (
        <VillageFormModal
          open={editOpen}
          mode="edit"
          title="แก้ไขหมู่บ้าน"
          geography={geography}
          initialValues={villageToFormValues(village)}
          statusLabel={village.isActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}
          pending={pending}
          serverError={serverError}
          onClose={() => {
            if (!pending) setEditOpen(false);
          }}
          onSubmit={async (values) => {
            setPending(true);
            setServerError("");
            try {
              const formData = new FormData();
              formData.set("id", village.id);
              Object.entries(values).forEach(([key, value]) => formData.set(key, value));
              await updateVillageAction(formData);
              pushToast({ tone: "success", title: "บันทึกข้อมูลหมู่บ้านแล้ว", description: village.name });
              setEditOpen(false);
              router.refresh();
            } catch (error) {
              const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาด";
              setServerError(message);
              pushToast({ tone: "error", title: "บันทึกไม่สำเร็จ", description: message });
            } finally {
              setPending(false);
            }
          }}
        />
      ) : null}

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
    </article>
  );
}
