import { AdminPageToolbar } from "@/components/ui/admin-page-toolbar";
import { SuperAdminPlaceForm } from "../superadmin-place-form";
export default async function NewPlace({params}:{params:Promise<{villageId:string}>}){const {villageId}=await params;return <div className="mx-auto w-full max-w-4xl space-y-4"><AdminPageToolbar sticky variant="form" backHref={`/superadmin/villages/${villageId}/places`} backLabel="กลับสถานที่" title="เพิ่มสถานที่" description="เพิ่มข้อมูลสถานที่ของหมู่บ้าน"/><SuperAdminPlaceForm villageId={villageId}/></div>}
