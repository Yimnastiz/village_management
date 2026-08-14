import { DownloadForm } from "../download-form";
import { AdminPageToolbar } from "@/components/ui/admin-page-toolbar";

export default function Page() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-3" data-admin-compact-top>
      <AdminPageToolbar sticky variant="form" backHref="/admin/downloads" backLabel="กลับรายการเอกสาร" backPlacement="header-end" title="เพิ่มเอกสาร" description="เพิ่มเอกสารและไฟล์สำหรับให้ลูกบ้านหรือบุคคลทั่วไปดาวน์โหลด" />
      <DownloadForm mode="create" />
    </div>
  );
}
