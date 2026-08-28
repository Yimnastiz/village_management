import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, SupportNotice } from "../public-content-ui";
import { transitionSuperAdminDownloadAction } from "../operational-actions";

export default async function Page({ params }: { params: Promise<{ villageId: string }> }) {
  const { villageId } = await params;
  const [village, files] = await Promise.all([
    prisma.village.findUnique({ where: { id: villageId }, select: { name: true } }),
    prisma.downloadFile.findMany({ where: { villageId }, orderBy: { createdAt: "desc" }, include: { attachments: { orderBy: { sortOrder: "asc" } } } }),
  ]);
  return <div className="space-y-4"><PageHeader title="เอกสารดาวน์โหลด" description="เผยแพร่ เก็บถาวร และคืนร่างเอกสารของหมู่บ้านที่เลือก" villageId={villageId} module="downloads" /><SupportNotice villageName={village?.name ?? "-"} /><section className="rounded-lg border bg-white">{files.map((file) => { const transition = transitionSuperAdminDownloadAction.bind(null, villageId, file.id); return <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4" key={file.id}><div><p className="font-medium">{file.title}</p><p className="text-sm text-slate-600">{file.stage} · {file.attachments.length} ไฟล์แนบ</p></div><form action={transition} className="flex flex-wrap gap-2"><Input name="supportReason" aria-label="เหตุผลในการดำเนินการ" placeholder="เหตุผลในการดำเนินการ" minLength={5} required />{file.stage !== "PUBLISHED" && <Button name="stage" value="PUBLISHED" type="submit">เผยแพร่</Button>}{file.stage === "PUBLISHED" && <Button name="stage" value="ARCHIVED" type="submit" variant="outline">เก็บถาวร</Button>}{file.stage === "ARCHIVED" && <Button name="stage" value="DRAFT" type="submit" variant="outline">คืนร่าง</Button>}</form></div>; })}</section></div>;
}
