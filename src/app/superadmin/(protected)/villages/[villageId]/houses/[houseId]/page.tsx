import Link from "next/link";
import { MembershipStatus } from "@prisma/client";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { HouseForm } from "@/features/population/components/house-form";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminPageSession } from "@/lib/superadmin";
import { maskNationalId } from "@/lib/utils";

import { deleteSuperAdminHouseFormAction, updateSuperAdminHouseAction } from "../../population-actions";

export default async function Page({
  params,
}: {
  params: Promise<{
    villageId: string;
    houseId: string;
  }>;
}) {
  await requireSuperAdminPageSession();

  const { villageId, houseId } = await params;

  const house = await prisma.house.findFirst({
    where: {
      id: houseId,
      villageId,
    },
    include: {
      village: {
        select: {
          name: true,
        },
      },
      zone: {
        select: {
          name: true,
        },
      },
      persons: {
        where: {
          villageId,
        },
        orderBy: [
          {
            firstName: "asc",
          },
          {
            lastName: "asc",
          },
        ],
      },
      memberships: {
        where: {
          villageId,
          status: MembershipStatus.ACTIVE,
        },
        include: {
          user: {
            select: {
              name: true,
              phoneNumber: true,
            },
          },
        },
        orderBy: {
          role: "asc",
        },
      },
    },
  });

  if (!house) {
    notFound();
  }

  const base = `/superadmin/villages/${villageId}`;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href={`${base}/houses`}
            className="text-sm text-slate-500 hover:text-slate-900"
          >
            ← กลับทะเบียนบ้าน
          </Link>

          <h2 className="mt-2 text-2xl font-semibold">
            บ้านเลขที่ {house.houseNumber}
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            {house.village.name} · ตรวจสอบข้อมูลและช่วยแก้ไขแทนผู้ดูแลหมู่บ้าน
          </p>
        </div>
      </header>

      <HouseForm
        mode="edit"
        action={updateSuperAdminHouseAction.bind(
          null,
          villageId,
          houseId,
        )}
        defaults={{
          houseNumber: house.houseNumber,
          address: house.address ?? "",
        }}
        requireReason
      />

      <section className="rounded-xl border border-rose-200 bg-rose-50 p-4">
        <h3 className="font-semibold text-rose-900">ลบบ้าน</h3>
        <p className="mt-1 text-sm text-rose-800">ลบได้เฉพาะบ้านที่ไม่มีประชากร สมาชิก คำขอผูกบ้าน หรือประวัติที่เชื่อมโยงอยู่</p>
        <form action={deleteSuperAdminHouseFormAction.bind(null, villageId, houseId)} className="mt-3 flex flex-wrap gap-2">
          <input name="supportReason" required minLength={5} placeholder="เหตุผลในการดำเนินการ *" className="min-h-10 rounded-lg border px-3" />
          <button type="submit" className="min-h-10 rounded-lg border border-rose-300 px-4 text-sm text-rose-800">ลบบ้าน</button>
        </form>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["ประชากร", `${house.persons.length} คน`],
          ["สมาชิกระบบ", `${house.memberships.length} บัญชี`],
          ["แหล่งข้อมูล", house.sourceType],
          ["โซน", house.zone?.name ?? "-"],
        ].map(([key, value]) => (
          <div
            key={key}
            className="rounded-xl border bg-white p-4"
          >
            <p className="text-xs text-slate-500">{key}</p>
            <p className="mt-1 font-semibold">{value}</p>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-xl border bg-white">
        <div className="border-b px-4 py-3 font-semibold">
          คนในทะเบียนบ้าน
        </div>

        <div className="divide-y">
          {house.persons.map((person) => (
            <Link
              key={person.id}
              href={`${base}/people/${person.id}`}
              className="flex flex-col gap-1 px-4 py-3 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="font-medium">
                {person.firstName} {person.lastName}
              </span>

              <span className="text-sm text-slate-500">
                {person.nationalId
                  ? maskNationalId(person.nationalId)
                  : "ไม่ระบุเลขบัตร"}{" "}
                · {person.status}
              </span>
            </Link>
          ))}

          {!house.persons.length ? (
            <p className="p-8 text-center text-sm text-slate-500">
              ยังไม่มีประชากรในบ้านนี้
            </p>
          ) : null}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border bg-white">
        <div className="border-b px-4 py-3 font-semibold">
          User / Membership ที่ผูกกับบ้าน
        </div>

        <div className="divide-y">
          {house.memberships.map((membership) => (
            <div
              key={membership.id}
              className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:justify-between"
            >
              <span className="font-medium">
                {membership.user.name}
              </span>

              <span className="text-sm text-slate-500">
                {membership.user.phoneNumber} · {membership.role} ·{" "}
                {membership.status}
              </span>
            </div>
          ))}

          {!house.memberships.length ? (
            <p className="p-8 text-center text-sm text-slate-500">
              ยังไม่มีบัญชีที่ผูกกับบ้านนี้
            </p>
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border bg-white p-4 text-sm">
        <h3 className="font-semibold">Metadata</h3>

        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">สร้างเมื่อ</dt>
            <dd>{house.createdAt.toLocaleString("th-TH")}</dd>
          </div>

          <div>
            <dt className="text-slate-500">แก้ไขล่าสุด</dt>
            <dd>{house.updatedAt.toLocaleString("th-TH")}</dd>
          </div>

          <div>
            <dt className="text-slate-500">ยืนยันเมื่อ</dt>
            <dd>
              {house.verifiedAt?.toLocaleString("th-TH") ?? "-"}
            </dd>
          </div>

          <div>
            <dt className="text-slate-500">
              หมายเหตุแหล่งข้อมูล
            </dt>
            <dd>{house.sourceNote ?? "-"}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
