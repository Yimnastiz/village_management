import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionContextFromServerCookies } from "@/lib/access-control";
import { ISSUE_CATEGORY_LABELS, ISSUE_PRIORITY_LABELS } from "@/lib/constants";
import { EditIssueForm } from "./edit-form";

interface PageProps {
  params: Promise<{ issueId: string }>;
}

export default async function EditIssuePage({ params }: PageProps) {
  const { issueId } = await params;
  const session = await getSessionContextFromServerCookies();
  if (!session?.id) redirect("/auth/login");

  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      priority: true,
      location: true,
      stage: true,
      reporterId: true,
    },
  });

  if (!issue) notFound();
  if (issue.reporterId !== session.id) redirect(`/resident/issues/${issueId}`);
  if (issue.stage !== "OPEN") redirect(`/resident/issues/${issueId}`);

  const categoryOptions = Object.entries(ISSUE_CATEGORY_LABELS).map(([v, l]) => ({
    value: v,
    label: l,
  }));
  const priorityOptions = Object.entries(ISSUE_PRIORITY_LABELS).map(([v, l]) => ({
    value: v,
    label: l,
  }));

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/resident/issues/${issueId}`}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">แก้ไขคำร้อง</h1>
      </div>

      <EditIssueForm
        issueId={issueId}
        defaultValues={{
          title: issue.title,
          description: issue.description,
          category: issue.category,
          priority: issue.priority,
          location: issue.location ?? "",
        }}
        categoryOptions={categoryOptions}
        priorityOptions={priorityOptions}
      />
    </div>
  );
}
