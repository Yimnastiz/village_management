"use client";

import { ImagePlus, Star, Trash2 } from "lucide-react";
import { FileUpload } from "@/components/ui/file-upload";
import { Button } from "@/components/ui/button";

type NewsImageManagerProps = { imageUrls: string[]; coverUrl?: string | null; onChange: (urls: string[]) => void; onCoverChange: (url: string | null) => void };

function fileToDataUrl(file: File) { return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || "")); reader.onerror = () => reject(new Error("read failed")); reader.readAsDataURL(file); }); }

export function NewsImageManager({ imageUrls, coverUrl, onChange, onCoverChange }: NewsImageManagerProps) {
  const setImages = (urls: string[]) => { onChange(urls); onCoverChange(urls.includes(coverUrl ?? "") ? coverUrl ?? null : urls[0] ?? null); };
  return <section className="space-y-3 rounded-xl border border-gray-200 p-4">
    <div><p className="text-sm font-medium text-gray-800">รูปภาพข่าว</p><p className="mt-0.5 text-xs text-gray-500">รูปแรกเป็นภาพหน้าปกโดยอัตโนมัติ และเลือกภาพอื่นเป็นภาพหน้าปกได้</p></div>
    <FileUpload label="เพิ่มรูปภาพ" accept="image/*" multiple maxSize={5 * 1024 * 1024} onFilesChange={async (files) => { const urls = await Promise.all(files.map(fileToDataUrl)); if (urls.length) setImages([...imageUrls, ...urls]); }} />
    {imageUrls.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{imageUrls.map((url) => <div key={url} className="group relative overflow-hidden rounded-lg border border-gray-200 bg-gray-50"><img src={url} alt="ตัวอย่างรูปข่าว" className="aspect-video w-full object-cover" />{coverUrl === url ? <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-green-600 px-2 py-1 text-xs font-medium text-white"><Star className="h-3 w-3 fill-current" />ภาพหน้าปก</span> : <Button type="button" size="sm" variant="outline" onClick={() => onCoverChange(url)} className="absolute bottom-2 left-2 bg-white/95 text-xs">ตั้งเป็นหน้าปก</Button>}<button type="button" onClick={() => setImages(imageUrls.filter((item) => item !== url))} aria-label="ลบรูปภาพ" className="absolute right-2 top-2 rounded-full bg-white/95 p-1.5 text-red-600 shadow-sm"><Trash2 className="h-3.5 w-3.5" /></button></div>)}</div> : <div className="flex aspect-[3/1] items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-500"><ImagePlus className="mr-2 h-4 w-4" />ยังไม่มีรูปภาพ</div>}
  </section>;
}
