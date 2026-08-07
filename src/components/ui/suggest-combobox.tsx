"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type SuggestOption = {
  value: string;
  label?: string;
  description?: string;
};

type SuggestComboboxProps = {
  id: string;
  name?: string;
  label: string;
  value: string;
  options: SuggestOption[];
  placeholder?: string;
  autoComplete?: string;
  helperText?: string;
  error?: string;
  disabled?: boolean;
  emptyMessage?: string;
  labelClassName?: string;
  helperClassName?: string;
  inputClassName?: string;
  onChange: (value: string) => void;
};

function normalizeSearchValue(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "");
}

export function SuggestCombobox({
  id,
  name,
  label,
  value,
  options,
  placeholder,
  autoComplete = "off",
  helperText,
  error,
  disabled,
  emptyMessage = "ไม่พบข้อมูล",
  labelClassName,
  helperClassName,
  inputClassName,
  onChange,
}: SuggestComboboxProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const filteredOptions = useMemo(() => {
    const keyword = normalizeSearchValue(value.trim());
    if (!keyword) {
      return options;
    }

    return options.filter((option) => {
      const haystacks = [option.value, option.label, option.description]
        .filter(Boolean)
        .join(" ");
      return normalizeSearchValue(haystacks).includes(keyword);
    });
  }, [options, value]);

  const selectedIndex = useMemo(
    () => filteredOptions.findIndex((option) => option.value === value),
    [filteredOptions, value]
  );

  useEffect(() => {
    if (activeIndex < 0) {
      return;
    }

    optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current) {
        return;
      }

      if (event.target instanceof Node && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, []);

  const listboxId = `${id}-listbox`;
  const activeDescendantId =
    open && activeIndex >= 0 && filteredOptions[activeIndex]
      ? `${id}-option-${filteredOptions[activeIndex].value}`
      : undefined;

  const selectOption = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
    setActiveIndex(-1);
  };

  const openOptions = () => {
    setOpen(true);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : filteredOptions.length > 0 ? 0 : -1);
  };

  return (
    <div className="relative w-full" ref={rootRef}>
      <label htmlFor={id} className={cn("mb-1 block text-sm font-medium text-gray-700", labelClassName)}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name ?? `${id}-suggest-query`}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          onFocus={openOptions}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={activeDescendantId}
          aria-autocomplete="list"
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              if (!open) {
                openOptions();
                return;
              }
              if (filteredOptions.length > 0) {
                setActiveIndex((prev) => (prev + 1) % filteredOptions.length);
              }
              return;
            }

            if (event.key === "ArrowUp") {
              event.preventDefault();
              if (!open) {
                openOptions();
                return;
              }
              if (filteredOptions.length > 0) {
                setActiveIndex((prev) =>
                  prev <= 0 ? filteredOptions.length - 1 : prev - 1
                );
              }
              return;
            }

            if (event.key === "Enter") {
              if (open && activeIndex >= 0 && filteredOptions[activeIndex]) {
                event.preventDefault();
                selectOption(filteredOptions[activeIndex].value);
              }
              return;
            }

            if (event.key === "Escape") {
              if (open) {
                event.preventDefault();
                setOpen(false);
                setActiveIndex(-1);
              }
            }
          }}
          className={cn(
            "block w-full rounded-lg border px-3 py-2 pr-10 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500",
            error ? "border-red-300 bg-red-50" : "border-gray-300 bg-white",
            disabled ? "cursor-not-allowed bg-gray-100 text-gray-400" : "",
            inputClassName
          )}
        />
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      </div>
      {open && !disabled ? (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl"
        >
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">{emptyMessage}</div>
          ) : (
            filteredOptions.map((option, index) => (
              <button
                key={`${id}-${option.value}`}
                type="button"
                id={`${id}-option-${option.value}`}
                role="option"
                aria-selected={option.value === value}
                ref={(element) => {
                  optionRefs.current[index] = element;
                }}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  selectOption(option.value);
                }}
                onMouseEnter={() => setActiveIndex(index)}
                className={cn(
                  "block w-full cursor-pointer px-3 py-2 text-left text-sm focus:bg-gray-100 focus:outline-none",
                  option.value === value && "bg-green-50",
                  activeIndex === index && "bg-gray-100",
                  activeIndex !== index && option.value !== value && "hover:bg-gray-50"
                )}
              >
                <div className="font-medium text-gray-800">{option.label ?? option.value}</div>
                {option.description ? <div className="text-xs text-gray-500">{option.description}</div> : null}
              </button>
            ))
          )}
        </div>
      ) : null}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
      {!error && helperText ? <p className={cn("mt-1 text-xs text-gray-500", helperClassName)}>{helperText}</p> : null}
    </div>
  );
}
