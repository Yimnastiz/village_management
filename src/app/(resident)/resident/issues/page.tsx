import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { redirect } from "next/navigation";
import { IssueCategory, IssuePriority, Prisma } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { ISSUE_CATEGORY_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { getResidentMembership, getSessionContextFromServerCookies } from "@/lib/access-control";
import { ResidentIssuesToolbar } from "./resident-issues-toolbar";
import { IssueStatusIndicator } from "@/components/issues/issue-status-indicator";
import { getIssuePriorityMeta } from "@/lib/issues/priority";
import { normalizeIssueImageUrls } from "@/lib/issues/images";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    priority?: string;
    category?: string;
    scope?: string;
    sort?: string;
  }>;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

const PRIORITY_ORDER_DESC = ["URGENT", "HIGH", "MEDIUM", "LOW"] as const;
const ISSUE_PRIORITY_VALUES: IssuePriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const ISSUE_CATEGORY_VALUES: IssueCategory[] = [
  "ROAD",
  "WATER",
  "ELECTRICITY",
  "SECURITY",
  "WASTE",
  "ENVIRONMENT",
  "PUBLIC_HEALTH",
  "OTHER",
];

export default async function ResidentIssuesPage({ searchParams }: PageProps) {
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");

  const membership = getResidentMembership(session);
  if (!membership) redirect("/resident/dashboard");

  const params = await searchParams;
  const keyword = params.q?.trim() ?? "";
  const scopeParam = (params.scope ?? "").trim();
  const selectedScopes = Array.from(
    new Set(
      scopeParam
        .split(",")
        .map((value) => value.trim())
        .filter((value): value is "mine" | "others" => value === "mine" || value === "others")
    )
  );
  const maybePriority = params.priority as IssuePriority | undefined;
  const maybeCategory = params.category as IssueCategory | undefined;
  const priorityFilter =
    maybePriority && ISSUE_PRIORITY_VALUES.includes(maybePriority)
      ? maybePriority
      : "ALL";
  const categoryFilter =
    maybeCategory && ISSUE_CATEGORY_VALUES.includes(maybeCategory)
      ? maybeCategory
      : "ALL";
  const sort = params.sort ?? "date_desc";

  const whereClause: Prisma.IssueWhereInput = {
    villageId: membership.villageId,
    ...(keyword
      ? {
          title: { contains: keyword, mode: "insensitive" as const },
        }
      : {}),
    ...(priorityFilter !== "ALL" ? { priority: priorityFilter } : {}),
    ...(categoryFilter !== "ALL" ? { category: categoryFilter } : {}),
    ...(selectedScopes.length === 1 && selectedScopes[0] === "mine"
      ? { reporterId: session.id }
      : selectedScopes.length === 1 && selectedScopes[0] === "others"
        ? { reporterId: { not: session.id }, isPublic: true }
        : {
            OR: [{ reporterId: session.id }, { reporterId: { not: session.id }, isPublic: true }],
          }),
  };

  const issues = await prisma.issue.findMany({
    where: whereClause,
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      category: true,
      priority: true,
      stage: true,
      createdAt: true,
      location: true,
      reporterId: true,
      isPublic: true,
      imageUrls: true,
    },
  });

  const titleSuggestions = await prisma.issue.findMany({
    where: {
      villageId: membership.villageId,
      OR: [{ reporterId: session.id }, { reporterId: { not: session.id }, isPublic: true }],
    },
    select: { title: true },
    orderBy: { createdAt: "desc" },
    take: 80,
  });
  const suggestionTitles = Array.from(new Set(titleSuggestions.map((item) => item.title))).slice(0, 20);

  const sortedIssues = [...issues].sort((left, right) => {
    if (sort === "date_asc") {
      return left.createdAt.getTime() - right.createdAt.getTime();
    }
    if (sort === "priority_desc") {
      const leftIndex = PRIORITY_ORDER_DESC.indexOf(left.priority as (typeof PRIORITY_ORDER_DESC)[number]);
      const rightIndex = PRIORITY_ORDER_DESC.indexOf(right.priority as (typeof PRIORITY_ORDER_DESC)[number]);
      if (leftIndex !== rightIndex) return leftIndex - rightIndex;
      return right.createdAt.getTime() - left.createdAt.getTime();
    }
    if (sort === "priority_asc") {
      const leftIndex = PRIORITY_ORDER_DESC.indexOf(left.priority as (typeof PRIORITY_ORDER_DESC)[number]);
      const rightIndex = PRIORITY_ORDER_DESC.indexOf(right.priority as (typeof PRIORITY_ORDER_DESC)[number]);
      if (leftIndex !== rightIndex) return rightIndex - leftIndex;
      return right.createdAt.getTime() - left.createdAt.getTime();
    }
    return right.createdAt.getTime() - left.createdAt.getTime();
  });

  return (
    <div className="space-y-6">
      <ResidentIssuesToolbar
        keyword={keyword}
        selectedScopes={selectedScopes}
        priorityFilter={priorityFilter}
        categoryFilter={categoryFilter}
        sort={sort}
        suggestionTitles={suggestionTitles}
      />

      {sortedIssues.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 sm:p-12 text-center">
          <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="font-medium text-gray-700">ยังไม่มีคำร้อง</p>
          <p className="text-sm text-gray-500 mt-1">กดปุ่มด้านบนเพื่อแจ้งปัญหาใหม่</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedIssues.map((issue) => {
            const priorityMeta = getIssuePriorityMeta(issue.priority);
            const imageUrls = normalizeIssueImageUrls(issue.imageUrls);
            const firstImage = imageUrls[0];
            const extraImageCount = imageUrls.length - 1;

            return (
            <Link
              key={issue.id}
              href={`/resident/issues/${issue.id}`}
              className="relative block overflow-hidden rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
            >
              <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1.5 ${priorityMeta.stripeClass}`} />
              <span className="sr-only">ระดับความสำคัญ: {priorityMeta.label}</span>
              <div className="flex items-start gap-3 sm:gap-4">
                {firstImage && (
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                    <img src={firstImage} alt="" loading="lazy" className="h-full w-full object-cover" />
                    {extraImageCount > 0 && <span className="absolute bottom-0 right-0 rounded-tl-md bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">+{extraImageCount}</span>}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{issue.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {ISSUE_CATEGORY_LABELS[issue.category]} • {formatDate(issue.createdAt)}
                      {issue.location && ` • ${issue.location}`}
                    </p>
                    <p className="text-xs mt-0.5 text-gray-500">
                      {issue.reporterId === session.id ? "ปัญหาของฉัน" : "ปัญหาของลูกบ้านคนอื่น"}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {issue.reporterId !== session.id && (
                    <Badge variant="outline" className="hidden md:inline-flex">ชุมชน</Badge>
                  )}
                  <IssueStatusIndicator stage={issue.stage} />
                </div>
              </div>
            </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
