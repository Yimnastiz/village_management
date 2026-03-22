import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Shield } from "lucide-react";
import { z } from "zod";
import { getSessionContextFromServerCookies } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

const profileUpdateSchema = z.object({
  name: z.string().trim().min(2, "ชื่อต้องมีอย่างน้อย 2 ตัวอักษร").max(120),
  email: z
    .union([z.literal(""), z.string().trim().email("รูปแบบอีเมลไม่ถูกต้อง")])
    .transform((value) => (value === "" ? null : value)),
  image: z
    .union([z.literal(""), z.string().trim().url("รูปโปรไฟล์ต้องเป็น URL ที่ถูกต้อง")])
    .transform((value) => (value === "" ? null : value)),
});

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

export async function updateProfileAction(formData: FormData) {
  "use server";

  const session = await getSessionContextFromServerCookies();
  if (!session) {
    redirect("/auth/login?callbackUrl=/resident/profile");
  }

  const parsed = profileUpdateSchema.safeParse({
    name: (formData.get("name") ?? "").toString(),
    email: (formData.get("email") ?? "").toString(),
    image: (formData.get("image") ?? "").toString(),
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง";
    redirect(`/resident/profile?error=${encodeURIComponent(message)}`);
  }

  const { name, email, image } = parsed.data;

  if (email) {
    const emailOwner = await prisma.user.findFirst({
      where: {
        email,
        id: { not: session.id },
      },
      select: { id: true },
    });

    if (emailOwner) {
      redirect("/resident/profile?error=%E0%B8%AD%E0%B8%B5%E0%B9%80%E0%B8%A1%E0%B8%A5%E0%B8%99%E0%B8%B5%E0%B9%89%E0%B8%96%E0%B8%B9%E0%B8%81%E0%B9%83%E0%B8%8A%E0%B9%89%E0%B8%87%E0%B8%B2%E0%B8%99%E0%B9%81%E0%B8%A5%E0%B9%89%E0%B8%A7");
    }
  }

  await prisma.user.update({
    where: { id: session.id },
    data: {
      name,
      email,
      image,
    },
  });

  revalidatePath("/resident/profile");
  redirect("/resident/profile?saved=1");
}

export const dynamic = "force-dynamic";

type ProfilePageProps = {
  searchParams?: Promise<{ saved?: string; error?: string }>;
};

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const params = (searchParams ? await searchParams : {}) ?? {};
  const saved = params.saved === "1";
  const errorMessage = params.error ? decodeURIComponent(params.error) : null;

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

      {saved && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          บันทึกข้อมูลโปรไฟล์เรียบร้อยแล้ว
        </div>
      )}

      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

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
        <form action={updateProfileAction} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700">
              ชื่อผู้ใช้งาน
            </label>
            <input
              id="name"
              name="name"
              defaultValue={user.name ?? ""}
              required
              minLength={2}
              maxLength={120}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
              อีเมล
            </label>
            <input
              id="email"
              name="email"
              type="email"
              defaultValue={user.email ?? ""}
              placeholder="example@email.com"
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="image" className="mb-1 block text-sm font-medium text-gray-700">
              รูปโปรไฟล์ (URL)
            </label>
            <input
              id="image"
              name="image"
              type="url"
              defaultValue={user.image ?? ""}
              placeholder="https://example.com/avatar.jpg"
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              บันทึกข้อมูลโปรไฟล์
            </button>
          </div>
        </form>
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
