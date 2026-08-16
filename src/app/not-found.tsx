import Link from "next/link";
import { Compass, Home, LayoutDashboard } from "lucide-react";
import { NotFoundBackButton } from "@/components/not-found-actions";
import {
  getAuthenticatedAccessRedirectPath,
  getSessionContextFromServerCookies,
} from "@/lib/access-control";
import { readSuperAdminSessionFromServerCookies } from "@/lib/superadmin-auth";

export const dynamic = "force-dynamic";

export default async function NotFound() {
  const [session, superAdminSession] = await Promise.all([
    getSessionContextFromServerCookies(),
    readSuperAdminSessionFromServerCookies(),
  ]);

  const dashboardHref = superAdminSession
    ? "/superadmin/dashboard"
    : session
      ? await getAuthenticatedAccessRedirectPath(session)
      : null;

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-b from-green-50 via-white to-white px-4 py-8 sm:px-6 sm:py-12">
      <section
        aria-labelledby="not-found-title"
        className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-xl shadow-slate-200/60 sm:p-10"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100 text-green-700 sm:h-16 sm:w-16">
          <Compass className="h-7 w-7 sm:h-8 sm:w-8" aria-hidden="true" />
        </div>

        <p className="mt-6 text-sm font-semibold tracking-[0.2em] text-green-700">ERROR 404</p>
        <h1 id="not-found-title" className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          ไม่พบหน้านี้
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600 sm:text-base">
          ลิงก์นี้อาจถูกย้าย ไม่มีอยู่แล้ว หรือคุณอาจพิมพ์ที่อยู่ไม่ถูกต้อง
        </p>

        <aside className="mt-6 rounded-2xl bg-slate-50 px-4 py-3 text-left text-sm leading-6 text-slate-600">
          <span className="font-semibold text-slate-800">คำแนะนำ:</span> หากพิมพ์ URL เอง ลองตรวจสอบตัวสะกดอีกครั้ง
        </aside>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {dashboardHref ? (
            <Link
              href={dashboardHref}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-green-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2 sm:w-auto"
            >
              <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
              ไปที่แดชบอร์ด
            </Link>
          ) : (
            <Link
              href="/"
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-green-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2 sm:w-auto"
            >
              <Home className="h-4 w-4" aria-hidden="true" />
              กลับหน้าหลัก
            </Link>
          )}
          <NotFoundBackButton />
        </div>
      </section>
    </main>
  );
}
