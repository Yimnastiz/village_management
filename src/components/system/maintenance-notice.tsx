import Link from "next/link";

export function MaintenanceNotice({ message, recoveryHref }: { message: string; recoveryHref?: string }) {
  return <div className="mx-auto flex w-full max-w-2xl items-start justify-center px-4 py-12 sm:py-20"><section className="w-full rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm sm:p-8"><p className="text-sm font-semibold text-amber-800">ประกาศสถานะระบบ</p><h1 className="mt-2 text-2xl font-bold text-amber-950">ระบบอยู่ระหว่างการปิดปรับปรุง</h1><p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-amber-900">{message}</p>{recoveryHref ? <Link href={recoveryHref} className="mt-6 inline-flex min-h-10 items-center rounded-lg bg-amber-800 px-4 py-2 text-sm font-medium text-white hover:bg-amber-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2">ไปที่การตั้งค่าระบบ</Link> : null}</section></div>;
}
