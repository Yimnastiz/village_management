import Link from "next/link";
import { redirect } from "next/navigation";
import { Shield } from "lucide-react";
import { getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";
import { ProfileEditForm } from "./profile-edit-form";

function splitDisplayName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  if (!trimmed) {
    return { firstName: "-", lastName: "-" };
  }

  const parts = trimmed.split(/\s+/);
  return {
    firstName: parts[0] ?? "-",
    lastName: parts.slice(1).join(" ") || "-",
  };
}

function formatDate(value: Date | null | undefined): string {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const dynamic = "force-dynamic";

export default async function ProfilePage() {

  const session = await getSessionContextFromServerCookies();
  if (!session) {
    redirect("/auth/login?callbackUrl=/resident/profile");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    include: {
      registrationVillage: {
        select: {
          name: true,
        },
      },
      memberships: {
        include: {
          village: {
            select: {
              name: true,
            },
          },
          house: {
            select: {
              houseNumber: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      },
    },
  });

  if (!user) {
    redirect("/auth/login?callbackUrl=/resident/profile");
  }

  const person = await prisma.person.findFirst({
    where: {
      phone: user.phoneNumber,
    },
    include: {
      house: {
        select: {
          houseNumber: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const activeMembership = user.memberships.find((membership) => membership.status === "ACTIVE") ?? user.memberships[0] ?? null;
  const names = splitDisplayName(user.name);
  const avatarText = (names.firstName?.[0] ?? user.phoneNumber?.[0] ?? "?").toUpperCase();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">โปรไฟล์</h1>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.image}
                alt="Profile"
                className="h-16 w-16 rounded-full border border-gray-200 object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-2xl font-bold text-green-700">
                {avatarText}
              </div>
            )}
            <div>
              <p className="font-semibold text-gray-900">{user.name || "-"}</p>
              <p className="text-sm text-gray-500">{user.phoneNumber || "-"}</p>
            </div>
          </div>

          <Link
            href="/resident/profile/security"
            className="flex items-center gap-2 text-sm text-green-600 hover:underline"
          >
            <Shield className="h-4 w-4" /> ความปลอดภัยบัญชี
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">แก้ไขโปรไฟล์</h2>
        <ProfileEditForm
          defaultName={user.name ?? ""}
          defaultEmail={user.email ?? ""}
          defaultImage={user.image ?? null}
          avatarText={avatarText}
        />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">ข้อมูลพื้นฐาน</h2>
        <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <div><span className="text-gray-500">ชื่อ:</span> <span className="font-medium text-gray-900">{names.firstName}</span></div>
          <div><span className="text-gray-500">นามสกุล:</span> <span className="font-medium text-gray-900">{names.lastName}</span></div>
          <div><span className="text-gray-500">อีเมล:</span> <span className="font-medium text-gray-900">{user.email || "-"}</span></div>
          <div><span className="text-gray-500">รหัสผู้ใช้:</span> <span className="font-medium text-gray-900">{user.id}</span></div>
          <div><span className="text-gray-500">เบอร์โทร:</span> <span className="font-medium text-gray-900">{user.phoneNumber || "-"}</span></div>
          <div><span className="text-gray-500">ยืนยันเบอร์โทร:</span> <span className="font-medium text-gray-900">{user.phoneNumberVerified ? "ยืนยันแล้ว" : "ยังไม่ยืนยัน"}</span></div>
          <div><span className="text-gray-500">ยืนยันอีเมล:</span> <span className="font-medium text-gray-900">{user.emailVerified ? "ยืนยันแล้ว" : "ยังไม่ยืนยัน"}</span></div>
          <div><span className="text-gray-500">ยืนยันตัวตนพลเมือง:</span> <span className="font-medium text-gray-900">{user.citizenVerifiedAt ? "ยืนยันแล้ว" : "รอตรวจสอบ"}</span></div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">ข้อมูลหมู่บ้านและที่อยู่</h2>
        <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <div><span className="text-gray-500">จังหวัด:</span> <span className="font-medium text-gray-900">{user.registrationProvince || "-"}</span></div>
          <div><span className="text-gray-500">อำเภอ:</span> <span className="font-medium text-gray-900">{user.registrationDistrict || "-"}</span></div>
          <div><span className="text-gray-500">ตำบล:</span> <span className="font-medium text-gray-900">{user.registrationSubdistrict || "-"}</span></div>
          <div><span className="text-gray-500">หมู่บ้านที่ลงทะเบียน:</span> <span className="font-medium text-gray-900">{user.registrationVillage?.name || "-"}</span></div>
          <div><span className="text-gray-500">หมู่บ้านที่สังกัดปัจจุบัน:</span> <span className="font-medium text-gray-900">{activeMembership?.village?.name || "-"}</span></div>
          <div><span className="text-gray-500">สถานะสมาชิก:</span> <span className="font-medium text-gray-900">{activeMembership?.status || "-"}</span></div>
          <div><span className="text-gray-500">บทบาทสมาชิก:</span> <span className="font-medium text-gray-900">{activeMembership?.role || "-"}</span></div>
          <div><span className="text-gray-500">บ้านเลขที่:</span> <span className="font-medium text-gray-900">{activeMembership?.house?.houseNumber || person?.house?.houseNumber || "-"}</span></div>
          <div><span className="text-gray-500">เลขบัตรประชาชน:</span> <span className="font-medium text-gray-900">{person?.nationalId || "-"}</span></div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">ข้อมูลการใช้งานบัญชี</h2>
        <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <div><span className="text-gray-500">สมัครเมื่อ:</span> <span className="font-medium text-gray-900">{formatDate(user.createdAt)}</span></div>
          <div><span className="text-gray-500">อัปเดตล่าสุด:</span> <span className="font-medium text-gray-900">{formatDate(user.updatedAt)}</span></div>
          <div><span className="text-gray-500">ยินยอมข้อมูลส่วนบุคคล:</span> <span className="font-medium text-gray-900">{formatDate(user.consentAt)}</span></div>
          <div><span className="text-gray-500">ยืนยันตัวตนเมื่อ:</span> <span className="font-medium text-gray-900">{formatDate(user.citizenVerifiedAt)}</span></div>
        </div>
      </div>
    </div>
  );
}
