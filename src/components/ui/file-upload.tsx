"use client";

import { useRef, useState } from "react";
import { cn, formatFileSize } from "@/lib/utils";
import { UploadCloud, X, FileText } from "lucide-react";

interface FileUploadProps {
  label?: string; accept?: string; multiple?: boolean; maxSize?: number; onFilesChange?: (files: File[]) => void; error?: string;
  /** Legacy consumers receive all selected files. New consumers receive only the current selection. */
  callbackMode?: "all" | "new"; showFileList?: boolean; imageOnly?: boolean; disabled?: boolean;
}

export function FileUpload({ label, accept, multiple, maxSize = 10 * 1024 * 1024, onFilesChange, error, callbackMode = "all", showFileList = true, imageOnly = false, disabled = false }: FileUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || disabled) return;
    const messages: string[] = [];
    const validFiles = Array.from(fileList).filter((file) => {
      const extension = file.name.split(".").pop()?.toLowerCase();
      if (imageOnly && (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || !['jpg', 'jpeg', 'png', 'webp'].includes(extension ?? ''))) {
        messages.push("รองรับเฉพาะไฟล์ JPG, PNG และ WebP"); return false;
      }
      if (file.size > maxSize) { messages.push(`ไฟล์ ${file.name} มีขนาดเกิน ${formatFileSize(maxSize)}`); return false; }
      return true;
    });
    setValidationErrors(messages);
    const updated = multiple ? [...files, ...validFiles] : validFiles;
    setFiles(updated);
    onFilesChange?.(callbackMode === "new" ? validFiles : updated);
  };

  const removeFile = (index: number) => {
    const updated = files.filter((_, i) => i !== index);
    setFiles(updated);
    if (callbackMode === "all") onFilesChange?.(updated);
  };

  return <div className="w-full">
    {label && <p className="mb-1 text-sm font-medium text-gray-700">{label}</p>}
    <div onClick={() => !disabled && inputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); if (!disabled) setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={(event) => { event.preventDefault(); setDragOver(false); handleFiles(event.dataTransfer.files); }} className={cn("rounded-lg border-2 border-dashed p-4 text-center transition-colors sm:p-6", disabled ? "cursor-not-allowed border-gray-200 bg-gray-100" : "cursor-pointer", dragOver ? "border-green-400 bg-green-50" : "border-gray-300 hover:border-gray-400")}>
      <UploadCloud className="mx-auto h-8 w-8 text-gray-400" />
      <p className="mt-2 text-sm text-gray-600">คลิกหรือลากไฟล์มาวางที่นี่</p><p className="mt-1 text-xs text-gray-400">ขนาดสูงสุด {formatFileSize(maxSize)}</p>
    </div>
    <input ref={inputRef} type="file" className="hidden" accept={accept} multiple={multiple} disabled={disabled} onChange={(event) => { handleFiles(event.target.files); event.currentTarget.value = ""; }} />
    {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    {validationErrors.map((message, index) => <p key={`${message}-${index}`} className="mt-1 text-xs text-red-600">{message}</p>)}
    {showFileList && files.length > 0 && <ul className="mt-2 space-y-1">{files.map((file, index) => <li key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"><div className="flex min-w-0 items-center gap-2"><FileText className="h-4 w-4 shrink-0 text-gray-400" /><span className="max-w-[200px] truncate text-sm text-gray-700">{file.name}</span><span className="text-xs text-gray-400">{formatFileSize(file.size)}</span></div><button type="button" onClick={() => removeFile(index)} className="text-gray-400 hover:text-red-500"><X className="h-4 w-4" /></button></li>)}</ul>}
  </div>;
}
