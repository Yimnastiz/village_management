"use client";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { UploadCloud, X, FileText } from "lucide-react";
import { formatFileSize } from "@/lib/utils";

interface FileUploadProps {
  label?: string;
  accept?: string;
  multiple?: boolean;
  maxSize?: number; // bytes
  onFilesChange?: (files: File[]) => void;
  error?: string;
}

export function FileUpload({ label, accept, multiple, maxSize = 10 * 1024 * 1024, onFilesChange, error }: FileUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    const validFiles = Array.from(newFiles).filter((f) => f.size <= maxSize);
    const updated = multiple ? [...files, ...validFiles] : validFiles;
    setFiles(updated);
    onFilesChange?.(updated);
  };

  const removeFile = (index: number) => {
    const updated = files.filter((_, i) => i !== index);
    setFiles(updated);
    onFilesChange?.(updated);
  };

  return (
    <div className="w-full">
      {label && <p className="text-sm font-medium text-gray-700 mb-1">{label}</p>}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
          dragOver ? "border-green-400 bg-green-50" : "border-gray-300 hover:border-gray-400"
        )}
      >
        <UploadCloud className="mx-auto h-8 w-8 text-gray-400" />
        <p className="mt-2 text-sm text-gray-600">คลิกหรือลากไฟล์มาวางที่นี่</p>
        <p className="text-xs text-gray-400 mt-1">
          ขนาดสูงสุด {formatFileSize(maxSize)}
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept}
        multiple={multiple}
        onChange={(e) => handleFiles(e.target.files)}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {files.length > 0 && (
        <ul className="mt-2 space-y-1">
          {files.map((file, i) => (
            <li key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-700 truncate max-w-[200px]">{file.name}</span>
                <span className="text-xs text-gray-400">{formatFileSize(file.size)}</span>
              </div>
              <button type="button" onClick={() => removeFile(i)} className="text-gray-400 hover:text-red-500">
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
