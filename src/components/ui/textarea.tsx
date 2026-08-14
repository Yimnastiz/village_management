import { cn } from "@/lib/utils";
import { TextareaHTMLAttributes, forwardRef, useId } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, helperText, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1">
            <span>{label}</span>{(props.required || props["aria-required"] === true || props["aria-required"] === "true") && <span aria-hidden="true" className="ml-1 text-red-600">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            "block w-full rounded-lg border px-3 py-2 text-sm shadow-sm resize-none",
            "focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent",
            "placeholder:text-gray-400",
            error ? "border-red-300 bg-red-50" : "border-gray-300 bg-white",
            className
          )}
          rows={4}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        {helperText && !error && <p className="mt-1 text-xs text-gray-500">{helperText}</p>}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";
