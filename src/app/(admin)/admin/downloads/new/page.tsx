import { DownloadForm } from "../download-form";

export default function Page() {
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">เพิ่มเอกสาร</h1>
      <DownloadForm mode="create" />
    </div>
  );
}
