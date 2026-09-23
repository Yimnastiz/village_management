import Link from "next/link";

export default function ForgotPage() {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-white/90 bg-white/90 p-6 shadow-xl shadow-emerald-950/10 ring-1 ring-emerald-100/80 backdrop-blur sm:p-8">
      <h1 className="text-xl font-bold text-gray-900">ขอความช่วยเหลือในการเข้าบัญชีบ้าน</h1>
      <p className="mt-3 text-sm leading-7 text-gray-600">
        หากไม่สามารถเข้าถึงอีเมลที่เชื่อมกับบัญชีบ้านได้ทั้งหมด กรุณาติดต่อผู้ใหญ่บ้านเพื่อตรวจสอบและช่วยดำเนินการ
      </p>
      <p className="mt-3 text-sm leading-7 text-gray-600">
        ระบบไม่ใช้เบอร์โทรศัพท์เป็นข้อมูลเข้าสู่ระบบของบัญชีบ้าน และยังไม่มีขั้นตอนกู้คืนบัญชีบ้านด้วยตนเองในระยะนี้
      </p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link href="/auth/login" className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800">กลับหน้าเข้าสู่ระบบ</Link>
        <Link href="/auth/register" className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">ขอเปิดบัญชีบ้าน</Link>
      </div>
    </div>
  );
}
