import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
export default function CorrectionsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">คำขอแก้ไขข้อมูล</h1>
        <Link href="/resident/household/corrections/new"><Button size="sm"><Plus className="h-4 w-4 mr-1" />ส่งคำขอใหม่</Button></Link>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center"><p className="text-gray-500">ยังไม่มีคำขอ</p></div>
    </div>
  );
}
