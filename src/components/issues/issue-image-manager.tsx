"use client";

import { useEffect, useRef, useState } from "react";
import { closestCenter, DndContext, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ImagePlus, Trash2 } from "lucide-react";
import { FileUpload } from "@/components/ui/file-upload";
import { MAX_IMAGE_BYTES, MAX_IMAGES_PER_REQUEST } from "@/lib/image-constraints";
import { issueImageUploadUrl, type IssueImageInput } from "@/lib/issue-images";
import { formatFileSize } from "@/lib/utils";

type Status = "uploaded" | "pending" | "uploading" | "error";
type LocalImage = IssueImageInput & { id: string; previewUrl: string; file?: File; status: Status };
type Props = { value: IssueImageInput[]; onChange: (items: IssueImageInput[]) => void; onBusyChange?: (busy: boolean) => void; disabled?: boolean };

const makeId = () => typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `issue-${Date.now()}-${Math.random()}`;
const signature = (items: IssueImageInput[]) => JSON.stringify(items);
const fileIdentity = (file: File) => `${file.name}\u0000${file.size}\u0000${file.lastModified}\u0000${file.type}`;

function ImageRow({ item, onRemove }: { item: LocalImage; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const details = [item.fileName, item.sizeBytes != null ? formatFileSize(item.sizeBytes) : null].filter(Boolean).join(" · ") || "รูปภาพ";

  return (
    <article ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`flex min-w-0 overflow-hidden rounded-lg border bg-white ${isDragging ? "z-10 border-green-500 opacity-80" : "border-gray-200"}`}>
      <div className="relative h-20 w-24 shrink-0 bg-gray-100 sm:w-28">
        <img src={item.previewUrl} alt={item.fileName || "รูปภาพประกอบปัญหา"} className="h-full w-full object-cover" />
        {item.status !== "uploaded" && <div className="absolute inset-0 flex items-center justify-center bg-gray-950/60 px-1 text-center text-[11px] font-medium text-white">{item.status === "error" ? "อัปโหลดไม่สำเร็จ" : "กำลังอัปโหลด..."}</div>}
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2">
        <p className="min-w-0 flex-1 truncate text-xs text-gray-600" title={details}>{details}</p>
        <button type="button" {...attributes} {...listeners} aria-label="ลากเพื่อจัดลำดับรูปภาพ" className="flex h-9 w-9 shrink-0 touch-none items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500">
          <GripVertical className="h-4 w-4" />
        </button>
        <button type="button" onClick={onRemove} aria-label="นำรูปภาพออก" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

export function IssueImageManager({ value, onChange, onBusyChange, disabled }: Props) {
  const [items, setItems] = useState<LocalImage[]>(() => value.map((item) => ({ ...item, id: makeId(), previewUrl: item.url, status: "uploaded" })));
  const itemsRef = useRef(items);
  const objectUrls = useRef(new Set<string>());
  const lastEmittedValue = useRef(signature(value));
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  );

  useEffect(() => () => { objectUrls.current.forEach((url) => URL.revokeObjectURL(url)); }, []);

  const commit = (next: LocalImage[]) => {
    itemsRef.current = next;
    setItems(next);
    const submitted = next.filter((item) => item.status === "uploaded").map((item) => ({
      url: item.url,
      ...(item.fileKey ? { fileKey: item.fileKey } : {}),
      ...(item.uploadToken ? { uploadToken: item.uploadToken } : {}),
      ...(item.fileName ? { fileName: item.fileName } : {}),
      ...(item.sizeBytes != null ? { sizeBytes: item.sizeBytes } : {}),
    }));
    lastEmittedValue.current = signature(submitted);
    onBusyChange?.(next.some((item) => item.status === "pending" || item.status === "uploading"));
    onChange(submitted);
  };

  useEffect(() => {
    if (signature(value) === lastEmittedValue.current) return;
    const incoming = value.map((item) => ({ ...item, id: makeId(), previewUrl: item.url, status: "uploaded" as const }));
    itemsRef.current = incoming;
    setItems(incoming);
    lastEmittedValue.current = signature(value);
  }, [value]);

  const upload = async (id: string, file: File) => {
    commit(itemsRef.current.map((item) => item.id === id ? { ...item, status: "uploading" } : item));
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/places/images", { method: "POST", body });
      const result = await response.json() as { url?: string; fileKey?: string; uploadToken?: string; size?: number; error?: string };
      if (!response.ok || !result.fileKey || !result.uploadToken) throw new Error(result.error || "อัปโหลดรูปภาพไม่สำเร็จ");
      const current = itemsRef.current.find((item) => item.id === id);
      if (current && objectUrls.current.delete(current.previewUrl)) URL.revokeObjectURL(current.previewUrl);
      commit(itemsRef.current.map((item) => item.id === id ? { ...item, url: result.url || issueImageUploadUrl(result.fileKey!), previewUrl: result.url || issueImageUploadUrl(result.fileKey!), fileKey: result.fileKey, uploadToken: result.uploadToken, sizeBytes: result.size || file.size, status: "uploaded" } : item));
    } catch {
      commit(itemsRef.current.map((item) => item.id === id ? { ...item, status: "error" } : item));
    }
  };

  const addFiles = (files: File[]) => {
    const known = new Set(itemsRef.current.filter((item) => item.file).map((item) => fileIdentity(item.file!)));
    const accepted = files.filter((file) => !known.has(fileIdentity(file))).slice(0, Math.max(0, MAX_IMAGES_PER_REQUEST - itemsRef.current.length));
    const additions = accepted.map((file) => {
      const previewUrl = URL.createObjectURL(file);
      objectUrls.current.add(previewUrl);
      return { id: makeId(), url: "", previewUrl, file, fileName: file.name, sizeBytes: file.size, status: "pending" as const };
    });
    if (!additions.length) return;
    commit([...itemsRef.current, ...additions]);
    additions.forEach((item) => void upload(item.id, item.file!));
  };

  const remove = (id: string) => {
    const item = itemsRef.current.find((entry) => entry.id === id);
    if (item && objectUrls.current.delete(item.previewUrl)) URL.revokeObjectURL(item.previewUrl);
    commit(itemsRef.current.filter((entry) => entry.id !== id));
  };

  const dragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = itemsRef.current.findIndex((item) => item.id === active.id);
    const to = itemsRef.current.findIndex((item) => item.id === over.id);
    if (from >= 0 && to >= 0) commit(arrayMove(itemsRef.current, from, to));
  };

  const busy = items.some((item) => item.status === "pending" || item.status === "uploading");
  return (
    <section className="space-y-3 rounded-xl border border-gray-200 p-3 sm:p-4">
      <div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-gray-900">รูปภาพประกอบปัญหา</h2><p className="mt-1 text-xs text-gray-500">รองรับ JPG, PNG และ WebP สูงสุด 5 MB ต่อรูป</p></div><span className="shrink-0 text-xs text-gray-500">{items.length}/{MAX_IMAGES_PER_REQUEST}</span></div>
      <FileUpload label="เพิ่มรูปภาพ" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" multiple maxSize={MAX_IMAGE_BYTES} imageOnly callbackMode="new" showFileList={false} disabled={disabled || items.length >= MAX_IMAGES_PER_REQUEST} onFilesChange={addFiles} />
      {busy && <p className="text-xs text-amber-700">กำลังอัปโหลดรูปภาพ กรุณารอให้เสร็จก่อนบันทึก</p>}
      {items.length > 0 ? <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={dragEnd}><SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}><div className="space-y-2">{items.map((item) => <ImageRow key={item.id} item={item} onRemove={() => remove(item.id)} />)}</div></SortableContext></DndContext> : <div className="flex min-h-20 items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-500"><ImagePlus className="mr-2 h-4 w-4" />ยังไม่มีรูปภาพ</div>}
    </section>
  );
}
