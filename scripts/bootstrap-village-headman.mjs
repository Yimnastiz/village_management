import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { PrismaPg } from "@prisma/adapter-pg";
import { AccountStatus, MembershipStatus, PrismaClient, VillageMembershipRole } from "@prisma/client";
import { BootstrapInputError, planVillageBootstrap, readBootstrapInput } from "./bootstrap-village-headman-core.mjs";

const projectRoot = path.resolve(import.meta.dirname, "..");

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
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    const result = await prisma.$transaction(async (tx) => {
      const activeVillages = await tx.village.findMany({ where: { isActive: true }, select: { id: true, name: true, slug: true, moo: true, province: true, district: true, subdistrict: true }, orderBy: { createdAt: "asc" }, take: 3 });
      const plan = planVillageBootstrap(activeVillages, input.village);
      const village = plan.kind === "existing" ? plan.village : await tx.village.create({ data: { ...plan.village, isActive: true } });
      const existingUser = await tx.user.findUnique({ where: { phoneNumber: input.headman.phoneNumber } });
      if (existingUser && existingUser.accountStatus !== AccountStatus.ACTIVE) throw new BootstrapInputError("HEADMAN_ACCOUNT_UNAVAILABLE", "The bootstrap phone belongs to a non-active account and was not changed.");
      const otherHeadmen = await tx.villageMembership.findMany({ where: { villageId: village.id, role: VillageMembershipRole.HEADMAN, status: MembershipStatus.ACTIVE, ...(existingUser ? { userId: { not: existingUser.id } } : {}) }, select: { userId: true } });
      if (otherHeadmen.length > 0) throw new BootstrapInputError("ACTIVE_HEADMAN_EXISTS", "The configured Village already has another active Headman; no membership was changed.");
      const user = existingUser ?? await tx.user.create({ data: { phoneNumber: input.headman.phoneNumber, name: input.headman.name, registrationVillageId: village.id, phoneNumberVerified: false } });
      const existingMembership = await tx.villageMembership.findUnique({ where: { userId_villageId: { userId: user.id, villageId: village.id } }, select: { joinedAt: true } });
      const joinedAt = existingMembership?.joinedAt ?? new Date();
      await tx.villageMembership.upsert({ where: { userId_villageId: { userId: user.id, villageId: village.id } }, update: { role: VillageMembershipRole.HEADMAN, status: MembershipStatus.ACTIVE, joinedAt }, create: { userId: user.id, villageId: village.id, role: VillageMembershipRole.HEADMAN, status: MembershipStatus.ACTIVE, joinedAt } });
      return { villageCreated: plan.kind === "create", userCreated: !existingUser };
    });
    console.log(`Village: ${result.villageCreated ? "created" : "existing"}`);
    console.log(`Headman user: ${result.userCreated ? "created" : "existing"}`);
    console.log("Headman membership: ACTIVE");
    console.log("Use the normal OTP login flow to sign in.");
  } finally { await prisma.$disconnect(); }
}

main().catch((error) => {
  console.error(`Bootstrap failed: ${error instanceof BootstrapInputError || error instanceof Error ? error.message : "Bootstrap failed."}`);
  process.exitCode = 1;
});
