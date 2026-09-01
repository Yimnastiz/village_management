import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DownloadForm } from "@/app/(admin)/admin/downloads/download-form";
import { SuperAdminPageHeaderRegistration } from "@/components/layout/superadmin-page-header-context";
export default async function Page({ params }: { params: Promise<{ villageId: string }> }) { const { villageId } = await params; return <div className="mx-auto w-full max-w-3xl space-y-3"><SuperAdminPageHeaderRegistration context={{ title: "เพิ่มเอกสาร", description: "เพิ่มเอกสารดาวน์โหลดของหมู่บ้าน" }} /><Link href={`/superadmin/villages/${villageId}/downloads`} className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-1 text-sm text-gray-600 hover:bg-gray-50"><ArrowLeft className="h-4 w-4" />กลับรายการเอกสาร</Link><DownloadForm mode="create" superAdmin={{ villageId }} /></div>; }
