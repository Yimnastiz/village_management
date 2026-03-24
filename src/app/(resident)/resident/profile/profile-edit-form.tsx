"use client";

import { useRef, useState } from "react";
import { User } from "lucide-react";
import { updateProfileAction } from "./actions";

interface ProfileEditFormProps {
  defaultName: string;
  defaultEmail: string;
  defaultImage: string | null;
  avatarText: string;
}

export function ProfileEditForm({
  defaultName,
  defaultEmail,
  defaultImage,
  avatarText,
}: ProfileEditFormProps) {
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [imagePreview, setImagePreview] = useState<string | null>(defaultImage);
  const [isPending, setIsPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    setError(null);
    setSuccess(false);

    const result = await updateProfileAction({
      name,
      email,
      image: imagePreview,
    });

    setIsPending(false);
    if (!result.success) {
      setError(result.error);
    } else {
      setSuccess(true);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          บันทึกข้อมูลโปรไฟล์เรียบร้อยแล้ว
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Avatar preview + file picker */}
      <div className="flex items-center gap-5">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="group relative flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100 border-2 border-dashed border-gray-300 hover:border-green-500 transition-colors"
          title="เปลี่ยนรูปโปรไฟล์"
        >
          {imagePreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-full bg-green-100 text-2xl font-bold text-green-700">
              {avatarText}
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
            <User className="h-6 w-6 text-white" />
          </div>
        </button>
        <div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-sm font-medium text-green-700 hover:underline"
          >
            อัปโหลดรูปโปรไฟล์
          </button>
          <p className="text-xs text-gray-500 mt-0.5">JPG, PNG, GIF ขนาดไม่เกิน 5 MB</p>
          {imagePreview && (
            <button
              type="button"
              onClick={() => {
                setImagePreview(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="mt-1 text-xs text-red-600 hover:underline"
            >
              ลบรูปโปรไฟล์
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Name */}
      <div>
        <label htmlFor="pf-name" className="mb-1 block text-sm font-medium text-gray-700">
          ชื่อผู้ใช้งาน <span className="text-red-500">*</span>
        </label>
        <input
          id="pf-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          maxLength={120}
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      {/* Email */}
      <div>
        <label htmlFor="pf-email" className="mb-1 block text-sm font-medium text-gray-700">
          อีเมล
        </label>
        <input
          id="pf-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="example@email.com"
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
      >
        {isPending ? "กำลังบันทึก..." : "บันทึกข้อมูลโปรไฟล์"}
      </button>
    </form>
  );
}
