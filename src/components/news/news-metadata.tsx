import { Archive, CircleCheck, Globe2, Pencil, Pin, Users } from "lucide-react";

type Props = { stage?: "DRAFT" | "PUBLISHED" | "ARCHIVED"; visibility: "PUBLIC" | "RESIDENT_ONLY"; isPinned?: boolean; showPinned?: boolean; showStage?: boolean; className?: string };

export function NewsMetadata({ stage, visibility, isPinned = false, showPinned = true, showStage = true, className }: Props) {
  return <div className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-gray-500 ${className ?? ""}`}>{showPinned && isPinned ? <span className="inline-flex items-center gap-1 text-amber-700"><Pin className="h-3.5 w-3.5" />ปักหมุด</span> : null}{showStage && stage === "DRAFT" ? <span className="inline-flex items-center gap-1"><Pencil className="h-3.5 w-3.5" />ร่าง</span> : showStage && stage === "PUBLISHED" ? <span className="inline-flex items-center gap-1 text-green-700"><CircleCheck className="h-3.5 w-3.5" />เผยแพร่แล้ว</span> : showStage && stage === "ARCHIVED" ? <span className="inline-flex items-center gap-1"><Archive className="h-3.5 w-3.5" />จัดเก็บแล้ว</span> : null}{visibility === "PUBLIC" ? <span className="inline-flex items-center gap-1"><Globe2 className="h-3.5 w-3.5" />สาธารณะ</span> : <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />เฉพาะลูกบ้าน</span>}</div>;
}
