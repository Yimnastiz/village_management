import { Globe2, Users } from "lucide-react";
import type { UseFormRegisterReturn } from "react-hook-form";

type RequestedVisibilityFieldProps = {
  publicInput: UseFormRegisterReturn;
  residentInput: UseFormRegisterReturn;
  residentValue: "RESIDENT" | "RESIDENT_ONLY";
  helperId: string;
  error?: string;
};

/** The shared resident-facing requested audience control. */
export function RequestedVisibilityField({ publicInput, residentInput, residentValue, helperId, error }: RequestedVisibilityFieldProps) {
  return <fieldset aria-describedby={helperId} aria-invalid={Boolean(error)}>
    <legend className="text-sm font-medium text-gray-700">การมองเห็นที่ต้องการ <span className="text-red-500">*</span></legend>
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      <label className="flex min-h-12 cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 has-[:checked]:border-green-600 has-[:checked]:bg-green-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-green-500"><input type="radio" value="PUBLIC" className="sr-only" {...publicInput} /><Globe2 className="h-4 w-4 text-gray-500" aria-hidden="true" />สาธารณะ</label>
      <label className="flex min-h-12 cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 has-[:checked]:border-green-600 has-[:checked]:bg-green-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-green-500"><input type="radio" value={residentValue} className="sr-only" {...residentInput} /><Users className="h-4 w-4 text-gray-500" aria-hidden="true" />เฉพาะลูกบ้าน</label>
    </div>
    <p id={helperId} className="mt-2 text-xs text-gray-500">ผู้ดูแลหมู่บ้านสามารถปรับการมองเห็นก่อนอนุมัติได้</p>
    {error ? <p className="mt-1 text-sm text-red-600">{error}</p> : null}
  </fieldset>;
}
