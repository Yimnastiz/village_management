import { NotificationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";
import { updateFeedbackNotificationStatusAction } from "./actions";

type PageProps = {
  searchParams?: Promise<{ q?: string; category?: string; status?: string; sort?: string }>;
};

type FeedbackRow = {
  id: string;
  title: string;
  body: string | null;
  status: NotificationStatus;
  createdAt: Date;
  name: string | null;
  email: string | null;
  category: string | null;
};

function normalizeSort(sort: string | undefined): "newest" | "oldest" {
  return sort === "oldest" ? "oldest" : "newest";
}

export default async function SuperAdminFeedbackPage({ searchParams }: PageProps) {
  const session = await requireSuperAdminPageSession();
  const params = (searchParams ? await searchParams : {}) ?? {};
  const keyword = (params.q ?? "").trim();
  const category = (params.category ?? "all").trim();
  const status = (params.status ?? "all").trim();
  const sort = normalizeSort(params.sort);

  const rows = await prisma.notification.findMany({
    where: {
      userId: session.id,
      metadata: {
        path: ["source"],
        equals: "PUBLIC_FEEDBACK",
      },
      ...(status !== "all" ? { status: status as NotificationStatus } : {}),
    },
    orderBy: { createdAt: sort === "oldest" ? "asc" : "desc" },
    take: 500,
    select: {
      id: true,
      title: true,
      body: true,
      status: true,
      createdAt: true,
      metadata: true,
    },
  });

  const feedbackRows: FeedbackRow[] = rows
    .map((row) => {
      const metadata = row.metadata as Record<string, unknown> | null;
      const parsedCategory = typeof metadata?.category === "string" ? metadata.category : null;
      const parsedName = typeof metadata?.name === "string" ? metadata.name : null;
      const parsedEmail = typeof metadata?.email === "string" ? metadata.email : null;

      return {
        id: row.id,
        title: row.title,
        body: row.body,
        status: row.status,
        createdAt: row.createdAt,
        name: parsedName,
        email: parsedEmail,
        category: parsedCategory,
      };
    })
    .filter((row) => {
      if (category !== "all" && row.category !== category) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      const haystack = [row.title, row.body, row.name, row.email, row.category].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(keyword.toLowerCase());
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Feedback จากผู้ใช้งาน</h1>
        <p className="mt-1 text-sm text-slate-600">ค้นหา กรอง จัดเรียง และจัดสถานะ feedback ที่ส่งมาจากหน้า public</p>
      </div>

      <form method="GET" className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-5">
        <input
          name="q"
          defaultValue={keyword}
          placeholder="ค้นหาจากหัวข้อ รายละเอียด ชื่อ หรืออีเมล"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-2"
        />
        <select name="category" defaultValue={category} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="all">ทุกประเภท</option>
          <option value="suggestion">ข้อเสนอแนะ</option>
          <option value="complaint">ร้องเรียน</option>
          <option value="bug">รายงานข้อผิดพลาด</option>
          <option value="other">อื่นๆ</option>
        </select>
        <select name="status" defaultValue={status} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="all">ทุกสถานะ</option>
          <option value="UNREAD">UNREAD</option>
          <option value="READ">READ</option>
          <option value="ARCHIVED">ARCHIVED</option>
        </select>
        <select name="sort" defaultValue={sort} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
          <option value="newest">ล่าสุดก่อน</option>
          <option value="oldest">เก่าสุดก่อน</option>
        </select>
        <div className="md:col-span-5 flex gap-2">
          <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">ค้นหา</button>
          <a href="/superadmin/feedback" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">ล้างตัวกรอง</a>
        </div>
      </form>

      <div className="space-y-3">
        {feedbackRows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">ยังไม่มี feedback ตามเงื่อนไขที่เลือก</div>
        ) : (
          feedbackRows.map((row) => (
            <article key={row.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-slate-900">{row.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{row.createdAt.toLocaleString("th-TH")}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{row.status}</span>
                  {row.category ? <span className="rounded-full bg-cyan-100 px-2 py-1 text-xs font-semibold text-cyan-800">{row.category}</span> : null}
                </div>
              </div>

              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{row.body || "-"}</p>

              <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-slate-600 md:grid-cols-2">
                <p>ชื่อผู้ส่ง: <span className="font-medium text-slate-900">{row.name || "ไม่ระบุ"}</span></p>
                <p>อีเมลผู้ส่ง: <span className="font-medium text-slate-900">{row.email || "ไม่ระบุ"}</span></p>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <form action={updateFeedbackNotificationStatusAction}>
                  <input type="hidden" name="notificationId" value={row.id} />
                  <input type="hidden" name="status" value="READ" />
                  <button type="submit" className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">ทำเครื่องหมายว่าอ่านแล้ว</button>
                </form>
                <form action={updateFeedbackNotificationStatusAction}>
                  <input type="hidden" name="notificationId" value={row.id} />
                  <input type="hidden" name="status" value="ARCHIVED" />
                  <button type="submit" className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50">เก็บถาวร</button>
                </form>
                <form action={updateFeedbackNotificationStatusAction}>
                  <input type="hidden" name="notificationId" value={row.id} />
                  <input type="hidden" name="status" value="UNREAD" />
                  <button type="submit" className="rounded-md border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50">ตั้งเป็นยังไม่อ่าน</button>
                </form>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
