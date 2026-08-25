import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DownloadForm } from "../download-form";

export default function Page() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-1 sm:px-0" data-admin-compact-top>
      <div className="flex items-center">
        <Link href="/admin/downloads" className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" />
          <span>กลับรายการเอกสาร</span>
        </Link>
      </div>
      <DownloadForm mode="create" />
    </div>
  );
}
