"use client";

import Link from "next/link";
import { ResidentFilterDropdown, ResidentMultiFilterDropdown, ResidentPageToolbar } from "@/components/resident/resident-page-toolbar";

type Sort = "newest" | "oldest";
type Visibility = "PUBLIC" | "RESIDENT_ONLY";
type SubmissionFilter = "ALL" | "OPEN" | "CLOSED";

type Props = {
  keyword: string;
  sort: Sort;
  villageName: string;
  selectedVisibilities: Visibility[];
  submissionFilter: SubmissionFilter;
  suggestionTitles: string[];
  canSubmit: boolean;
  hasResidentAccess: boolean;
};

function makeHref(keyword: string, sort: Sort, visibilities: Visibility[], submissionFilter: SubmissionFilter, hasResidentAccess: boolean) {
  const query = new URLSearchParams();
  if (hasResidentAccess && visibilities.length) query.set("visibility", [...new Set(visibilities)].sort().join(","));
  if (hasResidentAccess && submissionFilter !== "ALL") query.set("submissions", submissionFilter.toLowerCase());
  if (sort !== "newest") query.set("sort", sort);
  if (keyword.trim()) query.set("q", keyword.trim());
  return query.size ? `/resident/gallery?${query}` : "/resident/gallery";
}

export function ResidentGalleryToolbar({ keyword, sort, selectedVisibilities, submissionFilter, suggestionTitles, canSubmit, hasResidentAccess }: Props) {
  const has = (value: Visibility) => selectedVisibilities.includes(value);
  const toggle = (value: Visibility) => makeHref(
    keyword,
    sort,
    has(value) ? selectedVisibilities.filter((item) => item !== value) : [...selectedVisibilities, value],
    submissionFilter,
    hasResidentAccess,
  );
  const count = hasResidentAccess ? selectedVisibilities.length + Number(submissionFilter !== "ALL") : 0;

  return <ResidentPageToolbar
    namespace="resident-gallery"
    title="แกลเลอรี"
    registerHeader
    search={{ keyword, placeholder: "พิมพ์ชื่ออัลบั้ม", label: "ค้นหาอัลบั้ม", suggestions: suggestionTitles }}
    activeFilterCount={count}
    actions={canSubmit ? <Link href="/resident/gallery/requests" className="inline-flex min-h-11 items-center rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">คำขอของฉัน</Link> : null}
    filters={<>
      {hasResidentAccess ? <ResidentMultiFilterDropdown
        label="การมองเห็น"
        clearHref={makeHref(keyword, sort, [], submissionFilter, hasResidentAccess)}
        options={([['PUBLIC', 'สาธารณะ'], ['RESIDENT_ONLY', 'เฉพาะสมาชิก']] as const).map(([value, label]) => ({ label, href: toggle(value), active: has(value) }))}
      /> : null}
      {hasResidentAccess ? <ResidentFilterDropdown
        label="การส่งรูป"
        options={[
          { label: "ทั้งหมด", href: makeHref(keyword, sort, selectedVisibilities, "ALL", hasResidentAccess), active: submissionFilter === "ALL" },
          { label: "เปิดรับคำขอ", href: makeHref(keyword, sort, selectedVisibilities, "OPEN", hasResidentAccess), active: submissionFilter === "OPEN" },
          { label: "ปิดรับคำขอ", href: makeHref(keyword, sort, selectedVisibilities, "CLOSED", hasResidentAccess), active: submissionFilter === "CLOSED" },
        ]}
      /> : null}
      <ResidentFilterDropdown
        label="เรียง"
        options={([['newest', 'ล่าสุดก่อน'], ['oldest', 'เก่าสุดก่อน']] as const).map(([value, label]) => ({ label, href: makeHref(keyword, value, selectedVisibilities, submissionFilter, hasResidentAccess), active: sort === value }))}
      />
      {count > 0 ? <Link href={makeHref(keyword, sort, [], "ALL", hasResidentAccess)} className="inline-flex h-9 items-center rounded-md px-2 text-xs font-medium text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500">ล้างตัวกรอง</Link> : null}
    </>}
  />;
}
