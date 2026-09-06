import { prisma } from "@/lib/prisma";
import { getThaiGeographyHierarchy } from "@/lib/thai-geography";
import { RegisterForm } from "./register-form";
import { sanitizeInternalCallbackUrl } from "@/lib/callback-url";
import { getSystemSettings } from "@/lib/system-settings";

type RegisterPageProps = {
  searchParams?: Promise<{ callbackUrl?: string }>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const settings = await getSystemSettings();
  if (!settings.registrationEnabled) {
    return <div className="mx-auto max-w-xl px-4 py-12"><div className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><h1 className="text-xl font-semibold text-amber-950">ขณะนี้ปิดรับสมัครสมาชิกใหม่ชั่วคราว</h1><p className="mt-2 text-sm leading-6 text-amber-900">ระบบยังเปิดให้ผู้มีบัญชีเดิมเข้าสู่ระบบได้ตามปกติ กรุณาลองสมัครใหม่ภายหลัง</p></div></div>;
  }
  const thaiGeography = getThaiGeographyHierarchy();

  const villages = await prisma.village.findMany({
    where: { isActive: true },
    orderBy: [{ province: "asc" }, { district: "asc" }, { subdistrict: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      moo: true,
      slug: true,
      province: true,
      district: true,
      subdistrict: true,
    },
  });

  const params = searchParams ? await searchParams : {};

  return (
    <RegisterForm
      villages={villages}
      thaiGeography={thaiGeography}
      callbackUrl={sanitizeInternalCallbackUrl(params.callbackUrl) ?? undefined}
    />
  );
}
