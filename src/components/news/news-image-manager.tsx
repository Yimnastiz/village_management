"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Star, Trash2 } from "lucide-react";
import { FileUpload } from "@/components/ui/file-upload";
import { Button } from "@/components/ui/button";
import { MAX_IMAGE_BYTES, MAX_IMAGES_PER_REQUEST, MAX_TOTAL_IMAGE_DATA_URL_BYTES, NEWS_IMAGE_HELP_TEXT } from "@/lib/image-constraints";

export type NewsImageItem = { id: string; url: string; name?: string; size?: number };
type NewsImageManagerProps = { imageUrls: string[]; coverUrl?: string | null; onChange: (urls: string[]) => void; onCoverChange: (url: string | null) => void };

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `news-image-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

function fromUrls(urls: string[]): NewsImageItem[] { return urls.map((url) => ({ id: createId(), url })); }
function sameUrls(items: NewsImageItem[], urls: string[]) { return items.length === urls.length && items.every((item, index) => item.url === urls[index]); }

function readDataUrl(file: File) { return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || "")); reader.onerror = () => reject(new Error("read failed")); reader.readAsDataURL(file); }); }

async function imageToDataUrl(file: File): Promise<string> {
  // Modern browsers apply phone EXIF orientation while decoding into <img>. PNG is
  // left untouched when it already fits so its transparency is never flattened.
  if (file.type === "image/png") {
    const url = URL.createObjectURL(file);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => { const value = new Image(); value.onload = () => resolve(value); value.onerror = () => reject(new Error("decode failed")); value.src = url; });
      if (Math.max(image.naturalWidth, image.naturalHeight) <= 1920) return readDataUrl(file);
      const scale = 1920 / Math.max(image.naturalWidth, image.naturalHeight);
      const canvas = document.createElement("canvas"); canvas.width = Math.round(image.naturalWidth * scale); canvas.height = Math.round(image.naturalHeight * scale);
      canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/png");
    } finally { URL.revokeObjectURL(url); }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => { const value = new Image(); value.onload = () => resolve(value); value.onerror = () => reject(new Error("decode failed")); value.src = url; });
    const largest = Math.max(image.naturalWidth, image.naturalHeight);
    const scale = largest > 1920 ? 1920 / largest : 1;
    const canvas = document.createElement("canvas"); canvas.width = Math.round(image.naturalWidth * scale); canvas.height = Math.round(image.naturalHeight * scale);
    const context = canvas.getContext("2d"); if (!context) throw new Error("canvas unavailable");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL(file.type === "image/webp" ? "image/webp" : "image/jpeg", 0.86);
  } finally { URL.revokeObjectURL(url); }
}

export function NewsImageManager({ imageUrls, coverUrl, onChange, onCoverChange }: NewsImageManagerProps) {
  const [items, setItems] = useState<NewsImageItem[]>(() => fromUrls(imageUrls));
  const [coverId, setCoverId] = useState<string | null>(() => fromUrls([])[0]?.id ?? null);
  const [message, setMessage] = useState<string | null>(null);
  const itemsRef = useRef(items);

  const commit = (next: NewsImageItem[], nextCoverId: string | null) => {
    itemsRef.current = next; setItems(next); setCoverId(nextCoverId);
    onChange(next.map((item) => item.url));
    onCoverChange(next.find((item) => item.id === nextCoverId)?.url ?? next[0]?.url ?? null);
  };

  useEffect(() => {
    if (!sameUrls(itemsRef.current, imageUrls)) {
      const next = fromUrls(imageUrls); itemsRef.current = next;
      // This is deliberate prop-to-local-state synchronization for externally edited URLs.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setItems(next);
      const nextCover = next.find((item) => item.url === coverUrl)?.id ?? next[0]?.id ?? null;
      setCoverId(nextCover);
    } else {
      setCoverId(itemsRef.current.find((item) => item.url === coverUrl)?.id ?? itemsRef.current[0]?.id ?? null);
    }
  }, [imageUrls, coverUrl]);

  const addFiles = async (files: File[]) => {
    if (!files.length) return;
    const available = Math.max(0, MAX_IMAGES_PER_REQUEST - itemsRef.current.length);
    const accepted = files.slice(0, available);
    const excess = files.length - accepted.length;
    if (!accepted.length) { setMessage("เพิ่มรูปภาพได้สูงสุด 10 รูปต่อข่าว"); return; }
    const results = await Promise.allSettled(accepted.map(async (file) => ({ id: createId(), url: await imageToDataUrl(file), name: file.name, size: file.size })));
    const additions = results.filter((result): result is PromiseFulfilledResult<{ id: string; url: string; name: string; size: number }> => result.status === "fulfilled").map((result) => result.value);
    const failed = results.length - additions.length;
    const current = itemsRef.current;
    const room = Math.max(0, MAX_IMAGES_PER_REQUEST - current.length);
    const next = [...current, ...additions.slice(0, room)];
    const totalBytes = next.reduce((total, item) => total + new TextEncoder().encode(item.url).length, 0);
    if (totalBytes > MAX_TOTAL_IMAGE_DATA_URL_BYTES) { setMessage("ขนาดรวมของรูปภาพเกินขีดจำกัดสำหรับการบันทึก กรุณาลดจำนวนหรือเลือกไฟล์ขนาดเล็กลง"); return; }
    commit(next, coverId && current.some((item) => item.id === coverId) ? coverId : next[0]?.id ?? null);
    setMessage([excess ? `ไม่ได้เพิ่มรูปภาพ ${excess} รูป เพราะเกินจำนวนสูงสุด` : "", failed ? "ไม่สามารถอ่านไฟล์รูปภาพได้ กรุณาลองใหม่" : ""].filter(Boolean).join(" ") || null);
  };

  const removeItem = (id: string) => {
    const current = itemsRef.current; const next = current.filter((item) => item.id !== id);
    commit(next, id === coverId ? next[0]?.id ?? null : coverId);
  };
  const isFull = items.length >= MAX_IMAGES_PER_REQUEST;

  return <section className="space-y-3 rounded-xl border border-gray-200 p-3 sm:p-4">
    <div><p className="text-sm font-medium text-gray-800">รูปภาพข่าว</p><p className="mt-0.5 text-xs text-gray-500">{NEWS_IMAGE_HELP_TEXT}</p><p className="mt-0.5 text-xs text-gray-500">รูปแรกเป็นภาพหน้าปกโดยอัตโนมัติ และเลือกภาพอื่นเป็นภาพหน้าปกได้</p></div>
    <FileUpload label="เพิ่มรูปภาพ" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" multiple maxSize={MAX_IMAGE_BYTES} imageOnly callbackMode="new" showFileList={false} disabled={isFull} onFilesChange={addFiles} />
    {isFull && <p className="text-xs text-amber-700">เพิ่มรูปภาพได้สูงสุด 10 รูปต่อข่าว</p>}{message && <p className="text-xs text-red-600">{message}</p>}
    {items.length ? <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:grid-cols-3">{items.map((item) => <div key={item.id} className="group relative overflow-hidden rounded-lg border border-gray-200 bg-gray-50"><img src={item.url} alt="ตัวอย่างรูปข่าว" className="aspect-video w-full object-cover" />{coverId === item.id ? <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-green-600 px-2 py-1 text-xs font-medium text-white"><Star className="h-3 w-3 fill-current" />ภาพหน้าปก</span> : <Button type="button" size="sm" variant="outline" onClick={() => { setCoverId(item.id); onCoverChange(item.url); }} className="absolute bottom-2 left-2 bg-white/95 text-xs">ตั้งเป็นหน้าปก</Button>}<button type="button" onClick={() => removeItem(item.id)} aria-label="ลบรูปภาพ" className="absolute right-2 top-2 rounded-full bg-white/95 p-1.5 text-red-600 shadow-sm"><Trash2 className="h-3.5 w-3.5" /></button></div>)}</div> : <div className="flex aspect-[3/1] items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-500"><ImagePlus className="mr-2 h-4 w-4" />ยังไม่มีรูปภาพ</div>}
    {/* TODO: Base64 in JSON is transitional; migrate to existing object storage when a shared upload flow is available. */}
  </section>;
}
