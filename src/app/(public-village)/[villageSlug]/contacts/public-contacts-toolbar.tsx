"use client";

import { PublicPageToolbar } from "@/components/public/public-page-toolbar";

type Props = { keyword: string };

export function PublicContactsToolbar({ keyword }: Props) {
  return <PublicPageToolbar namespace="public-contacts" keyword={keyword} placeholder="ค้นหาผู้ติดต่อ" />;
}
