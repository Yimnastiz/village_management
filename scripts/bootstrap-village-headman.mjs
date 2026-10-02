import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { PrismaPg } from "@prisma/adapter-pg";
import { AccountKind, AccountStatus, MembershipStatus, PrismaClient, VillageMembershipRole } from "@prisma/client";
import { BootstrapInputError, planVillageBootstrap, readBootstrapInput, villageMasterFromInstallation } from "./bootstrap-village-headman-core.mjs";

const projectRoot = path.resolve(import.meta.dirname, "..");
const installationVillagePath = path.join(projectRoot, "config", "installation-village.json");

async function readInstallationVillage() {
  const config = JSON.parse(await fs.readFile(installationVillagePath, "utf8"));
  return villageMasterFromInstallation(config);
}

async function loadEnvironmentFile() {
  let content;
  try { content = await fs.readFile(path.join(projectRoot, ".env"), "utf8"); } catch (error) { if (error?.code === "ENOENT") return; throw error; }
  for (const line of content.split(/\r?\n/u)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/u.exec(line);
    if (!match || process.env[match[1]] !== undefined) continue;
    const rawValue = match[2];
    process.env[match[1]] = (rawValue.startsWith('"') && rawValue.endsWith('"')) || (rawValue.startsWith("'") && rawValue.endsWith("'")) ? rawValue.slice(1, -1) : rawValue;
  }
}

async function main() {
  await loadEnvironmentFile();
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required. Run npm run setup after configuring PostgreSQL.");
  const input = readBootstrapInput();
  const installationVillage = await readInstallationVillage();
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    const result = await prisma.$transaction(async (tx) => {
      const catalogVillage = await tx.thailandVillageMaster.upsert({
        where: { officialCode: installationVillage.officialCode },
        update: installationVillage,
        create: installationVillage,
        select: { id: true, officialCode: true, villageName: true, moo: true, slug: true, province: true, district: true, subdistrict: true },
      });
      const activeVillages = await tx.village.findMany({ where: { isActive: true }, select: { id: true, catalogVillageId: true }, orderBy: { createdAt: "asc" }, take: 3 });
      const plan = planVillageBootstrap(activeVillages, catalogVillage);
      const village = plan.kind === "existing" ? plan.village : await tx.village.create({ data: { ...plan.village, isActive: true } });
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`account-email:${input.headman.email}`}))`;
      const matchingUsers = await tx.user.findMany({ where: { OR: [{ phoneNumber: input.headman.phoneNumber }, { email: { equals: input.headman.email, mode: "insensitive" } }] } });
      if (matchingUsers.length > 1) throw new BootstrapInputError("HEADMAN_IDENTITY_AMBIGUOUS", "The bootstrap email and phone belong to different users.");
      const existingUser = matchingUsers[0] ?? null;
      if (existingUser && existingUser.accountStatus !== AccountStatus.ACTIVE) throw new BootstrapInputError("HEADMAN_ACCOUNT_UNAVAILABLE", "The bootstrap identity belongs to a non-active account and was not changed.");
      if (existingUser?.phoneNumber && existingUser.phoneNumber !== input.headman.phoneNumber) throw new BootstrapInputError("HEADMAN_PHONE_CONFLICT", "The bootstrap email belongs to a user with a different phone number.");
      if (existingUser?.email && existingUser.email.toLowerCase() !== input.headman.email) throw new BootstrapInputError("HEADMAN_EMAIL_CONFLICT", "The bootstrap phone belongs to a user with a different email.");
      const accountEmail = await tx.accountEmail.findUnique({ where: { normalizedEmail: input.headman.email }, select: { userId: true } });
      if (accountEmail && accountEmail.userId !== existingUser?.id) throw new BootstrapInputError("HEADMAN_EMAIL_CONFLICT", "The bootstrap email is reserved by another login account.");
      const otherHeadmen = await tx.villageMembership.findMany({ where: { villageId: village.id, role: VillageMembershipRole.HEADMAN, status: MembershipStatus.ACTIVE, ...(existingUser ? { userId: { not: existingUser.id } } : {}) }, select: { userId: true } });
      if (otherHeadmen.length > 0) throw new BootstrapInputError("ACTIVE_HEADMAN_EXISTS", "The configured Village already has another active Headman; no membership was changed.");
      if (existingUser && existingUser.accountKind !== AccountKind.HEADMAN) throw new BootstrapInputError("HEADMAN_ACCOUNT_KIND_MISMATCH", "The bootstrap identity belongs to a Resident House Account.");
      const user = existingUser
        ? await tx.user.update({ where: { id: existingUser.id }, data: { email: input.headman.email, phoneNumber: existingUser.phoneNumber ?? input.headman.phoneNumber } })
        : await tx.user.create({ data: { phoneNumber: input.headman.phoneNumber, email: input.headman.email, emailVerified: false, name: input.headman.name, accountKind: AccountKind.HEADMAN, phoneNumberVerified: false } });
      const existingMembership = await tx.villageMembership.findUnique({ where: { userId_villageId: { userId: user.id, villageId: village.id } }, select: { joinedAt: true } });
      const joinedAt = existingMembership?.joinedAt ?? new Date();
      await tx.villageMembership.upsert({ where: { userId_villageId: { userId: user.id, villageId: village.id } }, update: { role: VillageMembershipRole.HEADMAN, status: MembershipStatus.ACTIVE, joinedAt }, create: { userId: user.id, villageId: village.id, role: VillageMembershipRole.HEADMAN, status: MembershipStatus.ACTIVE, joinedAt } });
      return { villageCreated: plan.kind === "create", userCreated: !existingUser };
    });
    console.log(`Village: ${result.villageCreated ? "สร้างแล้ว" : "ใช้ข้อมูลเดิม"}`);
    console.log("ติดตั้งข้อมูลหมู่บ้านเขาทราย หมู่ 10 แล้ว");
    console.log(`Headman user: ${result.userCreated ? "created" : "existing"}`);
    console.log("Headman membership: ACTIVE");
    console.log("Headman login: use BOOTSTRAP_HEADMAN_EMAIL and the verification code sent by email.");
  } finally { await prisma.$disconnect(); }
}

main().catch((error) => {
  console.error(`Bootstrap failed: ${error instanceof BootstrapInputError || error instanceof Error ? error.message : "Bootstrap failed."}`);
  process.exitCode = 1;
});
