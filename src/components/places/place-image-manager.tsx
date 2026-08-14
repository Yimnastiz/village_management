"use client";

import { useEffect, useRef, useState } from "react";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowLeft, ArrowRight, GripVertical, ImagePlus, RotateCcw, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/ui/file-upload";
import { MAX_IMAGE_BYTES, MAX_IMAGES_PER_REQUEST } from "@/lib/image-constraints";
import { normalizePlaceImages, type PlaceImageInput, type PlaceImageView } from "@/lib/place-image";
import { formatFileSize } from "@/lib/utils";

type Status = "uploaded" | "pending" | "uploading" | "error";
type Item = PlaceImageView & { localId: string; previewUrl: string; status: Status; file?: File; error?: string };
type Props = {
  value: PlaceImageView[];
  onChange: (images: PlaceImageInput[]) => void;
  onBusyChange?: (busy: boolean) => void;
  disabled?: boolean;
  maxCount?: number;
  label?: string;
  autoSelectFirstCover?: boolean;
  allowCoverSelection?: boolean;
  allowReorder?: boolean;
  maxSizeBytes?: number;
  uploadEndpoint?: string;
  helpText?: string;
};

const makeId = () => typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `place-${Date.now()}-${Math.random()}`;

function SortableImage({ item, index, total, onCover, onRemove, onRetry, onMove, onDescription, allowCoverSelection, allowReorder }: {
  item: Item; index: number; total: number; onCover: () => void; onRemove: () => void; onRetry: () => void; onMove: (offset: number) => void; onDescription: (description: string) => void; allowCoverSelection: boolean; allowReorder: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.localId, disabled: !allowReorder || item.status !== "uploaded" });
  return <article ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`relative overflow-hidden rounded-xl border bg-white shadow-sm ${isDragging ? "z-10 border-green-500 opacity-80" : "border-gray-200"}`}>
    <div className="relative aspect-square bg-gray-100">
      <img src={item.previewUrl} alt={`รูปภาพลำดับ ${index + 1}`} className="h-full w-full object-cover" />
      {allowReorder ? <span className="absolute left-2 top-2 rounded-full bg-gray-950/75 px-2 py-1 text-xs font-semibold text-white">{index + 1}</span> : null}
      {allowCoverSelection && item.isCover ? <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-green-700 px-2 py-1 text-xs font-medium text-white"><Star className="h-3 w-3 fill-current" />หน้าปก</span> : null}
      {item.status !== "uploaded" ? <div className="absolute inset-0 flex items-center justify-center bg-gray-950/55 px-3 text-center text-xs font-medium text-white">{item.status === "error" ? "อัปโหลดไม่สำเร็จ" : "กำลังอัปโหลด..."}</div> : null}
    </div>
    <div className="space-y-2 p-2">
      {item.status === "error" ? <div className="grid grid-cols-2 gap-2"><Button type="button" size="sm" variant="outline" onClick={onRetry}><RotateCcw className="h-4 w-4" />ลองใหม่</Button><Button type="button" size="sm" variant="outline" onClick={onRemove}><Trash2 className="h-4 w-4" />นำออก</Button></div> : <>
        {allowReorder ? <div className="grid grid-cols-[44px_1fr_44px] gap-1"><button type="button" onClick={() => onMove(-1)} disabled={index === 0 || item.status !== "uploaded"} aria-label="เลื่อนไปก่อนหน้า" className="flex min-h-11 items-center justify-center rounded-lg border border-gray-200 disabled:opacity-30"><ArrowLeft className="h-4 w-4" /></button><button type="button" {...attributes} {...listeners} disabled={item.status !== "uploaded"} aria-label="ลากเพื่อจัดลำดับรูป" className="flex min-h-11 touch-none items-center justify-center rounded-lg border border-gray-200 text-gray-600"><GripVertical className="h-5 w-5" /></button><button type="button" onClick={() => onMove(1)} disabled={index === total - 1 || item.status !== "uploaded"} aria-label="เลื่อนไปถัดไป" className="flex min-h-11 items-center justify-center rounded-lg border border-gray-200 disabled:opacity-30"><ArrowRight className="h-4 w-4" /></button></div> : null}
        {(item.fileName || item.sizeBytes != null) ? <div className="min-w-0 text-xs text-gray-500">{item.fileName ? <p className="truncate">{item.fileName}</p> : null}{item.sizeBytes != null ? <p>{formatFileSize(item.sizeBytes)}</p> : null}</div> : null}
        <div className={allowCoverSelection ? "grid grid-cols-[1fr_44px] gap-1" : "grid grid-cols-1"}>{allowCoverSelection ? <button type="button" onClick={onCover} disabled={item.isCover} className="min-h-11 rounded-lg border border-gray-200 px-2 text-xs font-medium text-gray-700 disabled:bg-green-50 disabled:text-green-800">{item.isCover ? "หน้าปก" : "ตั้งเป็นหน้าปก"}</button> : null}<button type="button" onClick={onRemove} aria-label="นำรูปภาพออก" className="flex min-h-11 items-center justify-center rounded-lg border border-red-100 text-red-600"><Trash2 className="h-4 w-4" />{allowCoverSelection ? <span className="sr-only">นำออก</span> : <span className="ml-2 text-xs font-medium">นำออก</span>}</button></div>
        <label className="block text-xs font-medium text-gray-600">คำอธิบาย (ไม่บังคับ)<textarea value={item.description ?? ""} maxLength={500} onChange={(event) => onDescription(event.target.value)} className="mt-1 min-h-16 w-full rounded-lg border border-gray-200 p-2 text-sm font-normal" /></label>
      </>}
    </div>
  </article>;
}

export function PlaceImageManager({ value, onChange, onBusyChange, disabled, maxCount = MAX_IMAGES_PER_REQUEST, label = "รูปภาพ", autoSelectFirstCover = true, allowCoverSelection = true, allowReorder = true, maxSizeBytes = MAX_IMAGE_BYTES, uploadEndpoint = "/api/places/images", helpText }: Props) {
  const [items, setItems] = useState<Item[]>(() => value.map((image) => ({ ...image, localId: image.id ?? makeId(), previewUrl: image.url, status: "uploaded" })));
  const itemsRef = useRef(items);
  const objectUrls = useRef(new Set<string>());
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  useEffect(() => () => { objectUrls.current.forEach((url) => URL.revokeObjectURL(url)); }, []);

  const commit = (next: Item[]) => {
    const hasCover = next.some((item) => item.isCover);
    const normalized = next.map((item, index) => ({ ...item, sortOrder: index, isCover: allowCoverSelection ? (hasCover ? item.isCover : autoSelectFirstCover && index === 0) : false }));
    itemsRef.current = normalized; setItems(normalized);
    onBusyChange?.(normalized.some((item) => item.status === "pending" || item.status === "uploading"));
    const submitted = normalized.filter((item) => item.status === "uploaded").map((item) => ({ id: item.id, url: item.id ? undefined : item.url, fileKey: item.fileKey ?? undefined, uploadToken: item.uploadToken, sortOrder: item.sortOrder, isCover: item.isCover, description: item.description, fileName: item.fileName, sizeBytes: item.sizeBytes }));
    onChange(allowCoverSelection ? normalizePlaceImages(submitted) : submitted);
  };
  const upload = async (localId: string, file: File) => {
    commit(itemsRef.current.map((item) => item.localId === localId ? { ...item, status: "uploading", error: undefined } : item));
    try { const body = new FormData(); body.set("file", file); const response = await fetch(uploadEndpoint, { method: "POST", body }); const result = await response.json() as { url?: string; fileKey?: string; uploadToken?: string; size?: number; error?: string }; if (!response.ok || !result.url || !result.fileKey || !result.uploadToken) throw new Error(result.error || "upload failed"); const current = itemsRef.current.find((item) => item.localId === localId); if (current && objectUrls.current.delete(current.previewUrl)) URL.revokeObjectURL(current.previewUrl); commit(itemsRef.current.map((item) => item.localId === localId ? { ...item, url: result.url!, previewUrl: result.url!, fileKey: result.fileKey, uploadToken: result.uploadToken, sizeBytes: result.size ?? item.sizeBytes, status: "uploaded" } : item)); } catch { commit(itemsRef.current.map((item) => item.localId === localId ? { ...item, status: "error", error: "อัปโหลดรูปภาพไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" } : item)); }
  };
  const addFiles = (files: File[]) => { const accepted = files.slice(0, Math.max(0, maxCount - itemsRef.current.length)); const additions = accepted.map((file) => { const previewUrl = URL.createObjectURL(file); objectUrls.current.add(previewUrl); return { localId: makeId(), url: "", previewUrl, file, fileName: file.name, sizeBytes: file.size, status: "pending" as const, sortOrder: 0, isCover: allowCoverSelection && autoSelectFirstCover && itemsRef.current.length === 0 }; }); commit([...itemsRef.current, ...additions]); additions.forEach((item) => void upload(item.localId, item.file!)); };
  const remove = (localId: string) => { const item = itemsRef.current.find((row) => row.localId === localId); if (item && objectUrls.current.delete(item.previewUrl)) URL.revokeObjectURL(item.previewUrl); commit(itemsRef.current.filter((row) => row.localId !== localId)); };
  const move = (localId: string, offset: number) => { const index = itemsRef.current.findIndex((item) => item.localId === localId); const target = index + offset; if (index >= 0 && target >= 0 && target < itemsRef.current.length) commit(arrayMove(itemsRef.current, index, target)); };
  const dragEnd = ({ active, over }: DragEndEvent) => { if (!over || active.id === over.id) return; const oldIndex = itemsRef.current.findIndex((item) => item.localId === active.id); const newIndex = itemsRef.current.findIndex((item) => item.localId === over.id); if (oldIndex >= 0 && newIndex >= 0) commit(arrayMove(itemsRef.current, oldIndex, newIndex)); };
  const cards = <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{items.map((item, index) => <SortableImage key={item.localId} item={item} index={index} total={items.length} allowCoverSelection={allowCoverSelection} allowReorder={allowReorder} onCover={() => commit(itemsRef.current.map((row) => ({ ...row, isCover: row.localId === item.localId })))} onRemove={() => remove(item.localId)} onRetry={() => item.file && void upload(item.localId, item.file)} onMove={(offset) => move(item.localId, offset)} onDescription={(description) => commit(itemsRef.current.map((row) => row.localId === item.localId ? { ...row, description } : row))} />)}</div>;
  const busy = items.some((item) => item.status === "pending" || item.status === "uploading");
  return <section className="space-y-3 rounded-xl border border-gray-200 p-3 sm:p-4"><div><div className="flex items-center justify-between gap-3"><h2 className="font-semibold text-gray-900">{label}</h2><span className="text-xs text-gray-500">{items.length}/{maxCount}</span></div><p className="mt-1 text-xs text-gray-500">{helpText ?? `${allowReorder ? "ลากเพื่อจัดลำดับการแสดงผล " : ""}รองรับ JPG, PNG และ WebP สูงสุด ${formatFileSize(maxSizeBytes)} ต่อรูป`}</p></div><FileUpload label="เพิ่มรูปภาพ" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" multiple maxSize={maxSizeBytes} imageOnly callbackMode="new" showFileList={false} disabled={disabled || items.length >= maxCount} onFilesChange={addFiles} />{busy ? <p className="text-xs text-amber-700">กำลังอัปโหลดรูปภาพ กรุณารอให้เสร็จก่อน</p> : null}{items.length ? (allowReorder ? <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={dragEnd}><SortableContext items={items.map((item) => item.localId)} strategy={rectSortingStrategy}>{cards}</SortableContext></DndContext> : cards) : <div className="flex min-h-28 items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-500"><ImagePlus className="mr-2 h-4 w-4" />ยังไม่มีรูปภาพ</div>}</section>;
}
