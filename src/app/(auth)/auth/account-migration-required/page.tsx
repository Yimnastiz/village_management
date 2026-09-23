import { MigrationRequiredActions } from "./migration-actions";

export default function AccountMigrationRequiredPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-xl items-center px-4 py-12">
      <section className="w-full rounded-2xl border border-amber-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold text-amber-700">บัญชีเดิมต้องเปลี่ยนเป็นบัญชีบ้าน</p>
        <h1 className="mt-2 text-2xl font-bold text-gray-950">ไม่สามารถใช้บัญชีลูกบ้านรายบุคคลได้แล้ว</h1>
        <p className="mt-4 text-sm leading-7 text-gray-700">
          ระบบปัจจุบันใช้หนึ่งบัญชีต่อหนึ่งบ้านและเข้าสู่ระบบด้วยอีเมลที่ยืนยันแล้ว
          หากบ้านของคุณยังไม่มีบัญชีบ้าน ให้ส่งคำขอเปิดบัญชีบ้านใหม่ หรือสอบถามผู้ใหญ่บ้านเพื่อช่วยตรวจสอบข้อมูลเดิม
        </p>
        <MigrationRequiredActions />
      </section>
    </main>
  );
}
