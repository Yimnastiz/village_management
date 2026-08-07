import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { SystemRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const DEFAULT_BOOTSTRAP_SECRETS = new Set([
  "change-this-secret",
  "change-this-code",
  "change-this-before-running-setup",
]);

export type FirstSuperAdminBootstrapState = {
  hasSuperAdmin: boolean;
  isSecretConfigured: boolean;
  isSafeForProduction: boolean;
};

export function getBootstrapSecret(): string | null {
  const secret = process.env.SUPERADMIN_BOOTSTRAP_SECRET?.trim();
  return secret || null;
}

export function isBootstrapSecretSafeForEnvironment(secret = getBootstrapSecret()): boolean {
  if (!secret) return false;
  if (process.env.NODE_ENV !== "production") return true;
  return secret.length >= 24 && !DEFAULT_BOOTSTRAP_SECRETS.has(secret);
}

export function matchesBootstrapSecret(submittedSecret: string): boolean {
  const configuredSecret = getBootstrapSecret();
  if (!configuredSecret || !isBootstrapSecretSafeForEnvironment(configuredSecret)) return false;
  const expectedDigest = createHash("sha256").update(configuredSecret).digest();
  const submittedDigest = createHash("sha256").update(submittedSecret).digest();
  return timingSafeEqual(expectedDigest, submittedDigest);
}

export async function getFirstSuperAdminBootstrapState(): Promise<FirstSuperAdminBootstrapState> {
  const superAdminCount = await prisma.user.count({ where: { systemRole: SystemRole.SUPERADMIN } });
  const secret = getBootstrapSecret();
  return {
    hasSuperAdmin: superAdminCount > 0,
    isSecretConfigured: Boolean(secret),
    isSafeForProduction: isBootstrapSecretSafeForEnvironment(secret),
  };
}
