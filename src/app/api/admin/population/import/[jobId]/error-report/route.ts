import { MembershipStatus, VillageMembershipRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { getSessionContextFromRequest, isAdminUser } from "@/lib/access-control";
import { prisma } from "@/lib/prisma";

type ImportJobDetailsPayload = {
  errors?: string[];
};

const ADMIN_MEMBERSHIP_ROLES = new Set<VillageMembershipRole>([
  VillageMembershipRole.HEADMAN,
  VillageMembershipRole.ASSISTANT_HEADMAN,
  VillageMembershipRole.COMMITTEE,
]);

function parsePayload(value: unknown): ImportJobDetailsPayload {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as ImportJobDetailsPayload;
  }

  if (Array.isArray(value)) {
    return { errors: value.map((item) => String(item)) };
  }

  return {};
}

function toCsvValue(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const session = await getSessionContextFromRequest(request);
  if (!session?.id || !isAdminUser(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminMembership = session.memberships.find(
    (membership) =>
      membership.status === MembershipStatus.ACTIVE &&
      ADMIN_MEMBERSHIP_ROLES.has(membership.role),
  );
  if (!adminMembership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { jobId } = await context.params;

  const job = await prisma.populationImportJob.findFirst({
    where: {
      id: jobId,
      villageId: adminMembership.villageId,
    },
    select: {
      id: true,
      fileName: true,
      errors: true,
    },
  });

  if (!job) {
    return NextResponse.json({ error: "Import job not found" }, { status: 404 });
  }

  const payload = parsePayload(job.errors);
  const errors = payload.errors ?? [];

  if (errors.length === 0) {
    return NextResponse.json({ error: "No import errors for this job" }, { status: 404 });
  }

  const rows = ["line,error_message"];
  errors.forEach((error) => {
    const match = error.match(/^แถว\s*(\d+)\s*:\s*(.*)$/);
    const line = match?.[1] ?? "";
    const message = match?.[2] ?? error;
    rows.push(`${toCsvValue(line)},${toCsvValue(message)}`);
  });

  const csvContent = `\uFEFF${rows.join("\n")}`;
  const safeBaseName = job.fileName.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9ก-๙_-]+/g, "-");
  const fileName = `${safeBaseName || "import"}-errors.csv`;

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
