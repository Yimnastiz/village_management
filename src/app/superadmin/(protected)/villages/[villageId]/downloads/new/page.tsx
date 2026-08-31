import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DownloadForm } from "@/app/(admin)/admin/downloads/download-form";
export default async function Page({ params }: { params: Promise<{ villageId: string }> }) { const { villageId } = await params; return <div className="mx-auto w-full max-w-3xl space-y-3"><Link href={`/superadmin/villages/${villageId}/downloads`} className="inline-flex items-center gap-1.5 py-2 text-sm text-gray-500"><ArrowLeft className="h-4 w-4" />กลับรายการเอกสาร</Link><DownloadForm mode="create" superAdmin={{ villageId }} /></div>; }
