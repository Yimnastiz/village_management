export function MaintenanceNotice({ message }: { message: string }) {
  return <div className="mx-auto flex w-full max-w-2xl items-start justify-center px-4 py-12 sm:py-20"><section className="w-full rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm sm:p-8"><p className="text-sm font-semibold text-amber-800">ประกาศสถานะระบบ</p><h1 className="mt-2 text-2xl font-bold text-amber-950">ระบบอยู่ระหว่างการปรับปรุง</h1><p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-amber-900">{message}</p></section></div>;
}
