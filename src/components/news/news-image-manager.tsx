"use client";

import { useEffect, useRef, useState } from "react";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ImagePlus, RotateCcw, Star, Trash2 } from "lucide-react";
import { FileUpload } from "@/components/ui/file-upload";
import { Button } from "@/components/ui/button";
import { MAX_IMAGE_BYTES, MAX_IMAGES_PER_REQUEST, NEWS_IMAGE_HELP_TEXT } from "@/lib/image-constraints";
import { formatFileSize } from "@/lib/utils";

export type NewsImageItem = { url: string; fileKey?: string; uploadToken?: string; fileName?: string; sizeBytes?: number; sortOrder: number; isCover: boolean };
type Props = { value: NewsImageItem[]; onChange: (items: NewsImageItem[]) => void; onBusyChange?: (busy: boolean) => void; disabled?: boolean };
type Status = "uploaded" | "pending" | "uploading" | "error";
type LocalItem = NewsImageItem & { localId: string; previewUrl: string; file?: File; status: Status };

const makeId = () => typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `news-${Date.now()}-${Math.random()}`;
const uploadUrl = (fileKey: string) => `/api/places/images?key=${encodeURIComponent(fileKey)}`;
const signature = (items: NewsImageItem[]) => JSON.stringify(items.map(({ url, fileKey, uploadToken, fileName, sizeBytes, sortOrder, isCover }) => ({ url, fileKey, uploadToken, fileName, sizeBytes, sortOrder, isCover })));

function Card({ item, index, onRemove, onCover, onRetry }: { item: LocalItem; index: number; onRemove: () => void; onCover: () => void; onRetry: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.localId, disabled: item.status !== "uploaded" });
  const fileMeta = [item.fileName, item.sizeBytes != null ? formatFileSize(item.sizeBytes) : null].filter(Boolean).join(" · ") || "รูปภาพ";

  return <article ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`relative flex min-w-0 overflow-hidden rounded-lg border bg-white ${isDragging ? "z-10 border-green-500 opacity-80" : "border-gray-200"}`}>
    <div className="relative h-20 w-24 shrink-0 bg-gray-100 sm:w-28">
      <img src={item.previewUrl} alt={`รูปภาพลำดับ ${index + 1}`} className="h-full w-full object-cover" />
      {item.isCover ? <span className="absolute bottom-1 left-1 inline-flex items-center gap-1 rounded bg-green-700 px-1.5 py-0.5 text-[11px] font-medium text-white"><Star className="h-3 w-3 fill-current" />หน้าปก</span> : null}
      {item.status === "uploaded" ? <button type="button" {...attributes} {...listeners} aria-label="ลากเพื่อจัดลำดับรูปภาพ" className="absolute right-1 top-1 flex h-8 w-8 touch-none items-center justify-center rounded-md bg-gray-950/75 text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1"><GripVertical className="h-4 w-4" /></button> : <div className="absolute inset-0 flex items-center justify-center bg-gray-950/55 px-2 text-center text-[11px] font-medium text-white">{item.status === "error" ? "อัปโหลดไม่สำเร็จ" : "กำลังอัปโหลด..."}</div>}
    </div>
    <div className="flex min-w-0 flex-1 flex-col gap-1 px-2.5 py-2">
      <p className="truncate text-xs text-gray-500" title={fileMeta}>{fileMeta}</p>
      {item.status === "error" ? <div className="mt-auto flex items-center gap-1"><Button type="button" size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={onRetry}><RotateCcw className="mr-1 h-3.5 w-3.5" />ลองใหม่</Button><button type="button" onClick={onRemove} aria-label="นำรูปภาพออก" className="ml-auto flex h-9 w-9 items-center justify-center rounded-md text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"><Trash2 className="h-4 w-4" /></button></div> : <div className="mt-auto flex items-center gap-2"><button type="button" onClick={onCover} disabled={item.isCover || item.status !== "uploaded"} className="min-h-9 text-xs font-medium text-green-700 disabled:text-gray-500">{item.isCover ? "หน้าปก" : "ตั้งเป็นหน้าปก"}</button><button type="button" onClick={onRemove} aria-label="นำรูปภาพออก" className="ml-auto flex h-9 w-9 items-center justify-center rounded-md text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"><Trash2 className="h-4 w-4" /></button></div>}
    </div>
  </article>;
}

export function NewsImageManager({ value, onChange, onBusyChange, disabled }: Props) {
  const [items, setItems] = useState<LocalItem[]>(() => value.map((item) => ({ ...item, localId: makeId(), previewUrl: item.url, status: "uploaded" })));
  const itemsRef = useRef(items);
  const objectUrls = useRef(new Set<string>());
  const lastEmittedValue = useRef(signature(value));
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  useEffect(() => () => { objectUrls.current.forEach((url) => URL.revokeObjectURL(url)); }, []);

  const commit = (next: LocalItem[]) => {
    const hasCover = next.some((item) => item.isCover);
    const normalized = next.map((item, index) => ({ ...item, sortOrder: index, isCover: hasCover ? item.isCover : index === 0 }));
    const submitted = normalized.filter((item) => item.status === "uploaded").map(({ localId: _localId, previewUrl: _previewUrl, file: _file, status: _status, ...item }) => item);
    itemsRef.current = normalized;
    setItems(normalized);
    onBusyChange?.(normalized.some((item) => item.status === "pending" || item.status === "uploading"));
    // Parent state contains completed assets only; ignore that echoed value while
    // the selected batch is still in flight.
    lastEmittedValue.current = signature(submitted);
    onChange(submitted);
  };

  useEffect(() => {
    if (signature(value) === lastEmittedValue.current) return;
    const incoming = value.map((item) => ({ ...item, localId: makeId(), previewUrl: item.url, status: "uploaded" as const }));
    itemsRef.current = incoming;
    setItems(incoming);
    lastEmittedValue.current = signature(value);
  }, [value]);

  const upload = async (localId: string, file: File) => {
    commit(itemsRef.current.map((item) => item.localId === localId ? { ...item, status: "uploading" } : item));
    try {
      const body = new FormData(); body.set("file", file);
      const response = await fetch("/api/places/images", { method: "POST", body });
      const result = await response.json() as { url?: string; fileKey?: string; uploadToken?: string; size?: number; error?: string };
      if (!response.ok || !result.fileKey || !result.uploadToken) throw new Error(result.error);
      const current = itemsRef.current.find((item) => item.localId === localId);
      if (current && objectUrls.current.delete(current.previewUrl)) URL.revokeObjectURL(current.previewUrl);
      commit(itemsRef.current.map((item) => item.localId === localId ? { ...item, url: result.url ?? uploadUrl(result.fileKey!), previewUrl: result.url ?? uploadUrl(result.fileKey!), fileKey: result.fileKey, uploadToken: result.uploadToken, sizeBytes: result.size ?? file.size, status: "uploaded" } : item));
    } catch {
      commit(itemsRef.current.map((item) => item.localId === localId ? { ...item, status: "error" } : item));
    }
  };

  const addFiles = (files: File[]) => {
    const accepted = files.slice(0, Math.max(0, MAX_IMAGES_PER_REQUEST - itemsRef.current.length));
    const additions = accepted.map((file, index) => {
      const previewUrl = URL.createObjectURL(file); objectUrls.current.add(previewUrl);
      return { localId: makeId(), previewUrl, url: "", file, fileName: file.name, sizeBytes: file.size, sortOrder: 0, isCover: itemsRef.current.length === 0 && index === 0, status: "pending" as const };
    });
    if (!additions.length) return;
    commit([...itemsRef.current, ...additions]);
    additions.forEach((item) => void upload(item.localId, item.file));
  };
  const remove = (localId: string) => {
    const item = itemsRef.current.find((row) => row.localId === localId);
    if (item && objectUrls.current.delete(item.previewUrl)) URL.revokeObjectURL(item.previewUrl);
    commit(itemsRef.current.filter((item) => item.localId !== localId));
  };
  const dragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = itemsRef.current.findIndex((item) => item.localId === active.id); const to = itemsRef.current.findIndex((item) => item.localId === over.id);
    if (from >= 0 && to >= 0) commit(arrayMove(itemsRef.current, from, to));
  };
  const busy = items.some((item) => item.status === "pending" || item.status === "uploading");

  return <section className="space-y-3 rounded-xl border border-gray-200 p-3 sm:p-4"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-gray-900">รูปภาพ</h2><p className="mt-1 text-xs text-gray-500">{NEWS_IMAGE_HELP_TEXT} · ลากไอคอนบนรูปเพื่อจัดลำดับ</p></div><span className="shrink-0 text-xs text-gray-500">{items.length}/{MAX_IMAGES_PER_REQUEST}</span></div><FileUpload label="เพิ่มรูปภาพ" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" multiple maxSize={MAX_IMAGE_BYTES} imageOnly callbackMode="new" showFileList={false} disabled={disabled || busy || items.length >= MAX_IMAGES_PER_REQUEST} onFilesChange={addFiles} />{busy ? <p className="text-xs text-amber-700">กำลังอัปโหลดรูปภาพ กรุณารอให้เสร็จก่อนบันทึก</p> : null}{items.length ? <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={dragEnd}><SortableContext items={items.map((item) => item.localId)} strategy={verticalListSortingStrategy}><div className="space-y-2">{items.map((item, index) => <Card key={item.localId} item={item} index={index} onRemove={() => remove(item.localId)} onCover={() => commit(itemsRef.current.map((row) => ({ ...row, isCover: row.localId === item.localId })))} onRetry={() => item.file && void upload(item.localId, item.file)} />)}</div></SortableContext></DndContext> : <div className="flex min-h-20 items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-500"><ImagePlus className="mr-2 h-4 w-4" />ยังไม่มีรูปภาพ</div>}</section>;
}
