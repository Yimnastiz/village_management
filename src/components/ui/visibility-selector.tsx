import { Globe2, Users } from "lucide-react";
import type { UseFormRegisterReturn } from "react-hook-form";

type VisibilitySelectorProps = {
  publicInput: UseFormRegisterReturn;
  residentInput: UseFormRegisterReturn;
  residentValue: "RESIDENT" | "RESIDENT_ONLY";
  helperId?: string;
  label?: string;
  helperText?: string;
  error?: string;
  disabled?: boolean;
};

/** Shared card-style audience selector for calendar forms. */
export function VisibilitySelector({ publicInput, residentInput, residentValue, helperId, label = "การมองเห็น", helperText, error, disabled = false }: VisibilitySelectorProps) {
  const describedBy = [helperText ? helperId : null, error && helperId ? `${helperId}-error` : null].filter(Boolean).join(" ") || undefined;

  return <fieldset aria-describedby={describedBy} aria-invalid={Boolean(error)}>
    <legend className="text-sm font-medium text-gray-700">{label} <span className="text-red-500">*</span></legend>
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      <label className="flex min-h-12 cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 has-[:checked]:border-green-600 has-[:checked]:bg-green-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-green-500 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"><input type="radio" value="PUBLIC" className="sr-only" {...publicInput} disabled={disabled} /><Globe2 className="h-4 w-4 text-gray-500" aria-hidden="true" />สาธารณะ</label>
      <label className="flex min-h-12 cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 has-[:checked]:border-green-600 has-[:checked]:bg-green-50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-green-500 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"><input type="radio" value={residentValue} className="sr-only" {...residentInput} disabled={disabled} /><Users className="h-4 w-4 text-gray-500" aria-hidden="true" />เฉพาะสมาชิก</label>
    </div>
    {helperText ? <p id={helperId} className="mt-2 text-xs text-gray-500">{helperText}</p> : null}
    {error ? <p id={helperId ? `${helperId}-error` : undefined} className="mt-1 text-sm text-red-600">{error}</p> : null}
  </fieldset>;
}
