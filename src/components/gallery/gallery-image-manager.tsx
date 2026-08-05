"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { FileUpload } from "@/components/ui/file-upload";
import { Button } from "@/components/ui/button";
import { MAX_IMAGE_BYTES, MAX_IMAGES_PER_REQUEST, MAX_TOTAL_IMAGE_DATA_URL_BYTES } from "@/lib/image-constraints";

export type GalleryImageDraft = { id: string; url: string; name?: string; size?: number; mimeType?: string; description: string };
type Props = { value: GalleryImageDraft[]; onChange: (items: GalleryImageDraft[]) => void; maxCount?: number; label?: string; disabled?: boolean };
const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
const id = () => typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `gallery-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
const bytes = (value: string) => new TextEncoder().encode(value).length;

async function toDataUrl(file: File) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => { const element = new Image(); element.onload = () => resolve(element); element.onerror = () => reject(new Error("decode")); element.src = objectUrl; });
    const longest = Math.max(image.naturalWidth, image.naturalHeight);
    const scale = longest > 1920 ? 1920 / longest : 1;
    const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d"); if (!context) throw new Error("canvas");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL(file.type === "image/png" ? "image/png" : file.type === "image/webp" ? "image/webp" : "image/jpeg", 0.86);
  } finally { URL.revokeObjectURL(objectUrl); }
}

export function GalleryImageManager({ value, onChange, maxCount = MAX_IMAGES_PER_REQUEST, label = "เพิ่มรูปภาพ", disabled }: Props) {
  const [processing, setProcessing] = useState(false); const [message, setMessage] = useState<string | null>(null); const valueRef = useRef(value);
  useEffect(() => { valueRef.current = value; }, [value]);
  useEffect(() => () => { /* previews are data URLs; temporary object URLs are revoked in toDataUrl */ }, []);
  const add = async (files: File[]) => {
    const current = valueRef.current; const room = Math.max(0, maxCount - current.length); const seen = new Set(current.map((item) => `${item.name}:${item.size}`));
    const incoming = new Set<string>(); const candidates = files.filter((file) => { const key = `${file.name}:${file.size}`; if (seen.has(key) || incoming.has(key)) return false; incoming.add(key); return true; }).slice(0, room); const rejected = files.length - candidates.length;
    if (!candidates.length) { setMessage(`เพิ่มรูปภาพได้สูงสุด ${maxCount} รูปต่อครั้ง`); return; }
    setProcessing(true); setMessage(null);
    const results = await Promise.all(candidates.map(async (file) => {
      if (!allowed.has(file.type)) throw new Error(`ไม่รองรับ ${file.name} กรุณาเลือก JPG, PNG หรือ WebP`);
      if (file.size > MAX_IMAGE_BYTES) throw new Error(`${file.name} มีขนาดเกินกำหนด`);
      return { id: id(), url: await toDataUrl(file), name: file.name, size: file.size, mimeType: file.type, description: "" };
    }).map((task) => task.catch((error: unknown) => ({ error: error instanceof Error ? error.message : "ไม่สามารถประมวลผลรูปได้" }))));
    type Processed = { id: string; url: string; name: string; size: number; mimeType: string; description: string };
    const additions = results.filter((result): result is Processed => !("error" in result)); const errors = results.filter((result): result is { error: string } => "error" in result).map((result) => result.error);
    const next = [...current, ...additions];
    if (next.reduce((sum, item) => sum + bytes(item.url), 0) > MAX_TOTAL_IMAGE_DATA_URL_BYTES) { setMessage("ขนาดรวมของรูปภาพเกินกำหนด กรุณาลดจำนวนหรือเลือกรูปที่เล็กลง"); }
    else onChange(next);
    setProcessing(false); setMessage([rejected ? `ข้าม ${rejected} รูปเนื่องจากซ้ำหรือเกินจำนวนสูงสุด` : "", ...errors].filter(Boolean).join(" ") || null);
  };
  return <section className="min-w-0 space-y-3 rounded-xl border border-gray-200 p-3 sm:p-4"><div><p className="text-sm font-medium text-gray-800">{label} ({value.length}/{maxCount})</p><p className="text-xs text-gray-500">รองรับ JPG, PNG และ WebP ขนาดไม่เกิน 5 MB ต่อรูป ระบบจะปรับขนาดภาพจากโทรศัพท์อัตโนมัติ</p></div><FileUpload label="เลือกหรือลากรูปภาพมาวาง" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" multiple maxSize={MAX_IMAGE_BYTES} imageOnly callbackMode="new" showFileList={false} disabled={disabled || processing || value.length >= maxCount} onFilesChange={add}/>{processing && <p className="text-sm text-gray-500">กำลังเตรียมรูปภาพ…</p>}{message && <p className="text-sm text-red-600 break-words">{message}</p>}{value.length ? <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">{value.map((item) => <div key={item.id} className="min-w-0 overflow-hidden rounded-lg border bg-gray-50"><img src={item.url} alt={item.description || item.name || "ตัวอย่างรูปภาพ"} className="aspect-video w-full object-cover"/><div className="space-y-2 p-2"><p className="truncate text-xs text-gray-500">{item.name || "รูปภาพเดิม"}{item.size ? ` · ${(item.size / 1024 / 1024).toFixed(1)} MB` : ""}</p><label className="block text-xs font-medium text-gray-700">คำอธิบายรูปภาพ<textarea value={item.description} maxLength={500} disabled={disabled} onChange={(event) => onChange(valueRef.current.map((draft) => draft.id === item.id ? { ...draft, description: event.target.value } : draft))} className="mt-1 min-h-16 w-full rounded-md border border-gray-300 p-2 text-sm"/></label><Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => onChange(valueRef.current.filter((draft) => draft.id !== item.id))} className="w-full text-red-600"><Trash2 className="mr-1 h-4 w-4"/>ลบรูป</Button></div></div>)}</div> : <div className="flex min-h-28 items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-500"><ImagePlus className="mr-2 h-4 w-4"/>ยังไม่มีรูปภาพที่เลือก</div>}</section>;
}
