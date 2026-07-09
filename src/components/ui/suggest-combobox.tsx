"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type SuggestOption = {
  value: string;
  label?: string;
  description?: string;
};

type SuggestComboboxProps = {
  id: string;
  label: string;
  value: string;
  options: SuggestOption[];
  placeholder?: string;
  helperText?: string;
  error?: string;
  disabled?: boolean;
  emptyMessage?: string;
  onChange: (value: string) => void;
};

export function SuggestCombobox({
  id,
  label,
  value,
  options,
  placeholder,
  helperText,
  error,
  disabled,
  emptyMessage = "ไม่พบข้อมูล",
  onChange,
}: SuggestComboboxProps) {
  const [open, setOpen] = useState(false);

  const filteredOptions = useMemo(() => {
    const keyword = value.trim().toLowerCase();
    if (!keyword) {
      return options.slice(0, 12);
    }

    return options
      .filter((option) => {
        const haystacks = [option.value, option.label, option.description]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystacks.includes(keyword);
      })
      .slice(0, 12);
  }, [options, value]);

  return (
    <div className="relative w-full">
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
          }}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 120);
          }}
          className={cn(
            "block w-full rounded-lg border px-3 py-2 pr-10 text-sm shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500",
            error ? "border-red-300 bg-red-50" : "border-gray-300 bg-white",
            disabled ? "cursor-not-allowed bg-gray-100 text-gray-400" : ""
          )}
        />
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      </div>
      {open && !disabled ? (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl">
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">{emptyMessage}</div>
          ) : (
            filteredOptions.map((option) => (
              <button
                key={`${id}-${option.value}`}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
              >
                <div className="font-medium text-gray-800">{option.label ?? option.value}</div>
                {option.description ? <div className="text-xs text-gray-500">{option.description}</div> : null}
              </button>
            ))
          )}
        </div>
      ) : null}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
      {!error && helperText ? <p className="mt-1 text-xs text-gray-500">{helperText}</p> : null}
    </div>
  );
}
