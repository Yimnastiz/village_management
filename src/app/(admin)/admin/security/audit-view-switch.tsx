import Link from "next/link";

export function AuditViewSwitch({ view, href }: { view: "all" | "important"; href: (next: "all" | "important") => string }) {
  return <nav className="flex rounded-lg border border-gray-300 p-0.5" aria-label="มุมมองบันทึกกิจกรรม"><Link href={href("all")} className={`rounded-md px-3 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 ${view === "all" ? "bg-green-700 text-white" : "text-gray-700 hover:bg-gray-100"}`}>กิจกรรมทั้งหมด</Link><Link href={href("important")} className={`rounded-md px-3 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 ${view === "important" ? "bg-green-700 text-white" : "text-gray-700 hover:bg-gray-100"}`}>บันทึกสำคัญ</Link></nav>;
}
