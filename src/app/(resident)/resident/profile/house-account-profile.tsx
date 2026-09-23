import { Home, Mail, Phone, ShieldCheck } from "lucide-react";

function phoneDisplay(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 9) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
  return value;
}

export function HouseAccountProfile(props: {
  houseNumber: string;
  villageName: string;
  moo: string | null;
  contactPhone: string;
  activeEmailCount: number;
}) {
  const rows = [
    { icon: ShieldCheck, label: "สถานะบัญชี", value: "ใช้งานอยู่" },
    { icon: Phone, label: "เบอร์โทรสำหรับติดต่อ", value: phoneDisplay(props.contactPhone) },
    { icon: Mail, label: "จำนวนอีเมลสำหรับเข้าสู่ระบบ", value: `${props.activeEmailCount.toLocaleString("th-TH")} อีเมล` },
  ];
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <p className="text-sm font-medium text-green-700">บัญชีบ้าน</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">บ้านเลขที่ {props.houseNumber}</h1>
        <p className="mt-1 text-sm text-gray-600">
          {props.villageName}{props.moo != null ? ` หมู่ ${props.moo}` : ""}
        </p>
      </header>
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center gap-3 border-b border-gray-100 p-5">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-green-50 text-green-700"><Home className="h-5 w-5" aria-hidden="true" /></span>
          <div><h2 className="font-semibold text-gray-900">ข้อมูลบัญชีบ้าน</h2><p className="text-sm text-gray-500">บัญชีนี้ใช้ร่วมกันสำหรับบ้านหลังนี้</p></div>
        </div>
        <dl className="divide-y divide-gray-100">
          {rows.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-3 p-5">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
              <div className="min-w-0"><dt className="text-sm text-gray-500">{label}</dt><dd className="mt-1 break-words font-medium text-gray-900">{value}</dd></div>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
