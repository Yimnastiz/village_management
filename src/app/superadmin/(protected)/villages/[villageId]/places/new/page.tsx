import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SuperAdminPageHeaderRegistration } from "@/components/layout/superadmin-page-header-context";
import { SuperAdminPlaceForm } from "../superadmin-place-form";
export default async function NewPlace({params}:{params:Promise<{villageId:string}>}){const {villageId}=await params;return <div className="mx-auto flex w-full max-w-4xl flex-col gap-3"><SuperAdminPageHeaderRegistration priority={1} context={{title:"เพิ่มสถานที่",description:"เพิ่มข้อมูลสถานที่ของหมู่บ้าน"}}/><Link href={`/superadmin/villages/${villageId}/places`} className="inline-flex min-h-9 items-center gap-1.5 self-start px-1 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft className="h-4 w-4"/>กลับรายการสถานที่</Link><SuperAdminPlaceForm villageId={villageId}/></div>}
