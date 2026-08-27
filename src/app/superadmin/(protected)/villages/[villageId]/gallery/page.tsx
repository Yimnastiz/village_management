import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, ReasonField, SupportNotice } from "../public-content-ui";
import { deleteSuperAdminGalleryAlbumAction, reviewSuperAdminGallerySubmissionAction, saveSuperAdminGalleryAlbumAction } from "../operational-actions";

export default async function Page({ params }: { params: Promise<{ villageId: string }> }) {
  const { villageId } = await params;
  const [village, albums, submissions] = await Promise.all([
    prisma.village.findUnique({ where: { id: villageId }, select: { name: true } }),
    prisma.galleryAlbum.findMany({ where: { villageId }, orderBy: { albumDate: "desc" }, include: { _count: { select: { items: true, itemSubmissions: true } } } }),
    prisma.galleryItemSubmission.findMany({ where: { status: "PENDING", album: { villageId } }, orderBy: { createdAt: "asc" }, include: { album: { select: { title: true } }, requester: { select: { name: true } } } }),
  ]);
  const save = saveSuperAdminGalleryAlbumAction.bind(null, villageId);
  return <div className="space-y-4">
    <PageHeader title="แกลเลอรี" description="จัดการอัลบั้มและพิจารณารูปภาพที่ลูกบ้านส่ง" villageId={villageId} module="gallery" />
    <SupportNotice villageName={village?.name ?? "-"} />
    <form action={save} className="space-y-3 rounded-lg border bg-white p-4">
      <h3 className="font-semibold">สร้างอัลบั้ม</h3>
      <div className="grid gap-3 md:grid-cols-2"><Input name="title" label="ชื่ออัลบั้ม" required /><Input name="albumDate" label="วันที่" type="date" required /></div>
      <Textarea name="description" label="รายละเอียด" rows={2} />
      <label className="mr-5 inline-flex gap-2 text-sm"><input name="isPublic" type="checkbox" defaultChecked /> เผยแพร่สาธารณะ</label>
      <label className="inline-flex gap-2 text-sm"><input name="allowResidentSubmissions" type="checkbox" /> รับรูปจากลูกบ้าน</label>
      <ReasonField /><Button type="submit">สร้างอัลบั้ม</Button>
    </form>
    <section className="rounded-lg border bg-white"><div className="border-b p-4 font-semibold">อัลบั้ม</div>{albums.map((album) => { const remove = deleteSuperAdminGalleryAlbumAction.bind(null, villageId, album.id); return <div key={album.id} className="flex flex-wrap items-center justify-between gap-3 border-b p-4"><div><p className="font-medium">{album.title}</p><p className="text-sm text-slate-600">{album._count.items} รูป · รอตรวจ {album._count.itemSubmissions}</p></div><form action={remove} className="flex gap-2"><Input name="supportReason" aria-label="เหตุผล" placeholder="เหตุผล" minLength={5} required /><Button type="submit" variant="danger">ลบ</Button></form></div>; })}</section>
    <section className="rounded-lg border bg-white"><div className="border-b p-4 font-semibold">รูปภาพรอพิจารณา</div>{submissions.map((item) => { const review = reviewSuperAdminGallerySubmissionAction.bind(null, villageId, item.id); return <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-b p-4"><div><p className="font-medium">{item.title || "รูปภาพ"}</p><p className="text-sm text-slate-600">{item.album.title} · {item.requester.name}</p></div><form action={review} className="flex flex-wrap gap-2"><Input name="supportReason" aria-label="เหตุผลในการดำเนินการ" placeholder="เหตุผลในการดำเนินการ" minLength={5} required /><Button name="decision" value="APPROVE" type="submit">อนุมัติ</Button><Button name="decision" value="REJECT" type="submit" variant="danger">ปฏิเสธ</Button></form></div>; })}</section>
  </div>;
}
