import { prisma } from "@/lib/prisma";
import { getThaiGeographyHierarchy } from "@/lib/thai-geography";
import { RegisterForm } from "./register-form";

type RegisterPageProps = {
  searchParams?: Promise<{ callbackUrl?: string }>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const thaiGeography = getThaiGeographyHierarchy();

  const villages = await prisma.village.findMany({
    where: { isActive: true },
    orderBy: [{ province: "asc" }, { district: "asc" }, { subdistrict: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      province: true,
      district: true,
      subdistrict: true,
    },
  });

  const params = searchParams ? await searchParams : {};

  return (
    <RegisterForm
      villages={villages}
      thaiGeography={thaiGeography}
      callbackUrl={params.callbackUrl}
    />
  );
}

