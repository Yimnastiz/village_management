import { RegisterForm } from "./register-form";
import { sanitizeInternalCallbackUrl } from "@/lib/callback-url";
import { getSystemSettings } from "@/lib/system-settings";
import { ConfiguredVillageError, getConfiguredVillage } from "@/lib/configured-village";

type RegisterPageProps = {
  searchParams?: Promise<{ callbackUrl?: string }>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const settings = await getSystemSettings();
  if (!settings.registrationEnabled) {
    return <div className="mx-auto max-w-xl px-4 py-12"><div className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><h1 className="text-xl font-semibold text-amber-950">ขณะนี้ปิดรับสมัครสมาชิกใหม่ชั่วคราว</h1><p className="mt-2 text-sm leading-6 text-amber-900">ระบบยังเปิดให้ผู้มีบัญชีเดิมเข้าสู่ระบบได้ตามปกติ กรุณาลองสมัครใหม่ภายหลัง</p></div></div>;
  }
  let village;
  try {
    village = await getConfiguredVillage();
  } catch (error) {
    if (error instanceof ConfiguredVillageError) {
      return <div className="mx-auto max-w-xl px-4 py-12"><div className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><h1 className="text-xl font-semibold text-amber-950">ระบบยังไม่พร้อมสำหรับการสมัครสมาชิก</h1><p className="mt-2 text-sm leading-6 text-amber-900">กรุณาติดต่อผู้ดูแลระบบเพื่อตรวจสอบการตั้งค่าหมู่บ้าน</p></div></div>;
    }
    throw error;
  }

  const params = searchParams ? await searchParams : {};

  return (
    <RegisterForm
      village={village}
      callbackUrl={sanitizeInternalCallbackUrl(params.callbackUrl) ?? undefined}
    />
  );
}
