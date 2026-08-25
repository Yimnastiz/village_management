import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DownloadForm } from "../download-form";

export default function Page() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-1 sm:px-0" data-admin-compact-top>
      <div className="flex items-center gap-3"><Link href="/admin/downloads" className="text-gray-400 hover:text-gray-600"><ArrowLeft className="h-5 w-5" /></Link><h1 className="text-2xl font-bold text-gray-900">เพิ่มเอกสาร</h1></div>
      <DownloadForm mode="create" />
    </div>
  );
}
