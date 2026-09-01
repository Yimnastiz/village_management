import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { ImageCarousel } from "@/components/ui/image-carousel";
import { SuperAdminPageHeaderRegistration } from "@/components/layout/superadmin-page-header-context";
import { prisma } from "@/lib/prisma";
import { VILLAGE_PLACE_CATEGORY_LABELS } from "@/lib/constants";
import { parseVillagePlacePayload } from "@/lib/village-place";
import { SuperAdminPlaceRequestActions } from "../../superadmin-place-request-actions";

export default async function SuperAdminPlaceRequestDetail({ params }: { params: Promise<{ villageId: string; requestId: string }> }) {
  const { villageId, requestId } = await params;
  const db = (prisma as unknown as { villagePlaceSubmission: { findFirst: (args: unknown) => Promise<any> } }).villagePlaceSubmission;
  const row = await db.findFirst({ where: { id: requestId, villageId }, include: { requester: { select: { name: true, phoneNumber: true } } } });
  if (!row) notFound();
  const payload = parseVillagePlacePayload(row.payload); if (!payload) notFound();
  const images = payload.images.sort((a, b) => a.sortOrder - b.sortOrder).flatMap((image) => image.url ? [image.url] : []); const base = `/superadmin/villages/${villageId}/places/requests`; const statusClass: "warning" | "success" | "danger" = row.status === "PENDING" ? "warning" : row.status === "APPROVED" ? "success" : "danger";
  return <div className="mx-auto flex w-full max-w-4xl flex-col gap-3"><SuperAdminPageHeaderRegistration priority={1} context={{ title: "รายละเอียดคำขอสถานที่", description: "ตรวจสอบข้อมูลสถานที่และผู้ส่งคำขอ" }} /><Link href={base} className="inline-flex min-h-9 items-center gap-1.5 self-start px-1 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft className="h-4 w-4" />กลับคำขอสถานที่</Link><article className="space-y-5 rounded-xl border border-gray-200 bg-white p-4 sm:p-8"><div className="flex flex-wrap gap-2"><Badge variant="outline">{row.type}</Badge><Badge variant={statusClass}>{row.status}</Badge><Badge variant="outline">{VILLAGE_PLACE_CATEGORY_LABELS[payload.category] ?? payload.category}</Badge></div><h1 className="break-words text-2xl font-bold text-gray-900">{payload.name}</h1><p className="text-sm text-gray-600">ผู้ส่ง: {row.requester.name} · {row.requester.phoneNumber}</p>{payload.description ? <p className="whitespace-pre-wrap leading-7 text-gray-700">{payload.description}</p> : null}<div className="grid gap-2 rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-700">{payload.address ? <p>ที่อยู่: {payload.address}</p> : null}{payload.openingHours ? <p>เวลาเปิด-ปิด: {payload.openingHours}</p> : null}{payload.contactPhone ? <p>โทรศัพท์: {payload.contactPhone}</p> : null}{payload.latitude != null && payload.longitude != null ? <p>พิกัด: {payload.latitude}, {payload.longitude}</p> : null}</div>{images.length ? <ImageCarousel images={images} altPrefix={payload.name} /> : null}{row.status === "PENDING" ? <SuperAdminPlaceRequestActions villageId={villageId} submissionId={row.id} /> : <p className="text-sm text-gray-500">คำขอนี้ถูกดำเนินการแล้ว</p>}</article></div>;
}
