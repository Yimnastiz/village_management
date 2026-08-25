import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DownloadForm } from "../download-form";

export default function Page() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-1 sm:px-0" data-admin-compact-top>
      <div className="pt-1">
        <Link href="/admin/downloads" className="inline-flex min-h-9 items-center gap-1.5 px-1 py-1.5 text-sm text-gray-500 transition-colors hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2">
          <ArrowLeft className="h-4 w-4" />
          <span>กลับรายการเอกสาร</span>
        </Link>
      </div>
      <DownloadForm mode="create" />
    </div>
  );
}
