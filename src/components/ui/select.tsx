import { cn } from "@/lib/utils";
import { SelectHTMLAttributes, forwardRef, useId, useMemo } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, helperText, options, placeholder, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const normalizedOptions = useMemo(() => {
      const seen = new Set<string>();
      return options.filter((option) => {
        const value = option.value?.trim();
        if (!value || seen.has(value)) return false;
        seen.add(value);
        return true;
      });
    }, [options]);
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1">
            <span>{label}</span>{(props.required || props["aria-required"] === true || props["aria-required"] === "true") && <span aria-hidden="true" className="ml-1 text-red-600">*</span>}
          </label>
        )}
        <select
          ref={ref}
          id={inputId}
          className={cn(
            "block w-full cursor-pointer rounded-lg border bg-white px-3 py-2 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50",
            "focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent",
            error ? "border-red-300 bg-red-50" : "border-gray-300",
            className
          )}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {normalizedOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        {helperText && !error && <p className="mt-1 text-xs text-gray-500">{helperText}</p>}
      </div>
    );
  }
);
Select.displayName = "Select";
