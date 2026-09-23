import { RegisterForm } from "./register-form";
import { getSystemSettings } from "@/lib/system-settings";
import { ConfiguredVillageError, getConfiguredVillage } from "@/lib/configured-village";

export default async function RegisterPage() {
  const settings = await getSystemSettings();
  if (!settings.registrationEnabled) {
    return <div className="mx-auto max-w-xl px-4 py-12"><div className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><h1 className="text-xl font-semibold text-amber-950">ขณะนี้ปิดรับคำขอเปิดบัญชีบ้านชั่วคราว</h1><p className="mt-2 text-sm leading-6 text-amber-900">ผู้มีบัญชีเดิมยังเข้าสู่ระบบได้ตามปกติ กรุณาลองส่งคำขอใหม่ภายหลัง</p></div></div>;
  }
  if (settings.maintenanceMode) {
    return <div className="mx-auto max-w-xl px-4 py-12"><div className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><h1 className="text-xl font-semibold text-amber-950">ระบบอยู่ระหว่างการปรับปรุง</h1><p className="mt-2 text-sm leading-6 text-amber-900">ขณะนี้ยังไม่สามารถส่งคำขอเปิดบัญชีบ้านได้ กรุณาลองใหม่ภายหลัง</p></div></div>;
  }
  let village;
  try {
    village = await getConfiguredVillage();
  } catch (error) {
    if (error instanceof ConfiguredVillageError) {
      return <div className="mx-auto max-w-xl px-4 py-12"><div className="rounded-2xl border border-amber-200 bg-amber-50 p-6"><h1 className="text-xl font-semibold text-amber-950">ระบบยังไม่พร้อมรับคำขอเปิดบัญชีบ้าน</h1><p className="mt-2 text-sm leading-6 text-amber-900">กรุณาติดต่อผู้ดูแลระบบเพื่อตรวจสอบการตั้งค่าหมู่บ้าน</p></div></div>;
    }
    throw error;
  }

  return <RegisterForm village={village} />;
}
