import type { UseFormRegisterReturn } from "react-hook-form";
import { VisibilitySelector } from "@/components/ui/visibility-selector";

type RequestedVisibilityFieldProps = {
  publicInput: UseFormRegisterReturn;
  residentInput: UseFormRegisterReturn;
  residentValue: "RESIDENT" | "RESIDENT_ONLY";
  helperId: string;
  error?: string;
};

/** The shared resident-facing requested audience control. */
export function RequestedVisibilityField({ publicInput, residentInput, residentValue, helperId, error }: RequestedVisibilityFieldProps) {
  return <VisibilitySelector publicInput={publicInput} residentInput={residentInput} residentValue={residentValue} helperId={helperId} label="การมองเห็นที่ต้องการ" helperText="ผู้ดูแลหมู่บ้านสามารถปรับการมองเห็นก่อนอนุมัติได้" error={error} />;
}
