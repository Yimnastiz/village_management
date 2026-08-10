"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { villageName: string; children: ReactNode };

export function SupportSubmitButton({ villageName: _villageName, children, ...props }: Props) {
  void _villageName;
  return <button {...props} type="submit">{children}</button>;
}
