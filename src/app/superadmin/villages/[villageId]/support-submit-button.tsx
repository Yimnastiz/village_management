"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  villageName: string;
  children: ReactNode;
};

export function SupportSubmitButton({ villageName, children, onClick, ...props }: Props) {
  return (
    <button
      {...props}
      type="submit"
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        const confirmed = window.confirm(
          `คุณกำลังดำเนินการแทนผู้ดูแลหมู่บ้าน “${villageName}”\nการกระทำนี้จะถูกบันทึกใน Audit Log`,
        );
        if (!confirmed) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
