"use client";

import Link from "next/link";
import { Inbox, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminListToolbar } from "@/components/ui/admin-list-toolbar";
import { AdminPendingCountBadge } from "@/components/ui/admin-pending-count-badge";

type Props = { keyword: string; stage: string; visibility: string; sort: string; suggestionTitles: string[]; pendingCount: number };

function href(keyword: string, stage: string, visibility: string, sort: string) {
  const params = new URLSearchParams();
  if (keyword.trim()) params.set("q", keyword.trim());
  if (stage !== "ALL") params.set("stage", stage);
  if (visibility !== "ALL") params.set("visibility", visibility);
  if (sort !== "newest") params.set("sort", sort);
  const query = params.toString();
  return query ? `/admin/news?${query}` : "/admin/news";
}

export function AdminNewsToolbar({ keyword, stage, visibility, sort, suggestionTitles, pendingCount }: Props) {
  return (
    <AdminListToolbar
      sticky
      title="เธเธฑเธ”เธเธฒเธฃเธเนเธฒเธง"
      description="เธเนเธเธซเธฒเนเธฅเธฐเธเธฃเธญเธเธเนเธฒเธงเธ•เธฒเธกเธชเธ–เธฒเธเธฐเนเธฅเธฐเธเธฒเธฃเธกเธญเธเน€เธซเนเธ"
      searchAction="/admin/news"
      clearHref="/admin/news"
      keyword={keyword}
      searchPlaceholder="เธเนเธเธซเธฒเธเธทเนเธญเธซเธฃเธทเธญเน€เธเธทเนเธญเธซเธฒเธเนเธฒเธง"
      searchLabel="เธเนเธเธซเธฒเธเนเธฒเธง"
      suggestionTitles={suggestionTitles}
      groups={[
        { label: "เธชเธ–เธฒเธเธฐ", options: [["ALL", "เธ—เธฑเนเธเธซเธกเธ”"], ["DRAFT", "เธฃเนเธฒเธ"], ["PUBLISHED", "เน€เธเธขเนเธเธฃเน"], ["ARCHIVED", "เธเธฑเธ”เน€เธเนเธเนเธฅเนเธง"]].map(([value, label], index) => ({ label, href: href(keyword, value, visibility, sort), active: stage === value, isDefault: index === 0 })) },
        { label: "เธเธฒเธฃเธกเธญเธเน€เธซเนเธ", options: [["ALL", "เธ—เธฑเนเธเธซเธกเธ”"], ["PUBLIC", "เธชเธฒเธเธฒเธฃเธ“เธฐ"], ["RESIDENT_ONLY", "เธฅเธนเธเธเนเธฒเธ"]].map(([value, label], index) => ({ label, href: href(keyword, stage, value, sort), active: visibility === value, isDefault: index === 0 })) },
        { label: "เน€เธฃเธตเธขเธ", options: [["newest", "เธฅเนเธฒเธชเธธเธ”"], ["oldest", "เน€เธเนเธฒเธชเธธเธ”"]].map(([value, label], index) => ({ label, href: href(keyword, stage, visibility, value), active: sort === value, isDefault: index === 0 })) },
      ]}
      actions={<>
        <Link href="/admin/news/requests" aria-label={pendingCount > 0 ? `เธเธณเธเธญเธเนเธฒเธงเธเธฒเธเธฅเธนเธเธเนเธฒเธ ${pendingCount} เธฃเธฒเธขเธเธฒเธฃเธฃเธญเธเธดเธเธฒเธฃเธ“เธฒ` : "เธเธณเธเธญเธเนเธฒเธงเธเธฒเธเธฅเธนเธเธเนเธฒเธ"}><Button size="sm" variant="outline" className="h-10 px-2 sm:px-3"><Inbox className="h-4 w-4" /><span className="hidden sm:ml-1.5 sm:inline">เธเธณเธเธญเธเนเธฒเธง</span></Button>{pendingCount > 0 ? <AdminPendingCountBadge count={pendingCount} /> : null}</Link>
        <Link href="/admin/news/new"><Button size="sm" className="h-10 px-2 sm:px-3"><Plus className="h-4 w-4" /><span className="ml-1 hidden min-[360px]:inline">เน€เธเธดเนเธกเธเนเธฒเธง</span></Button></Link>
      </>}
    />
  );
}


