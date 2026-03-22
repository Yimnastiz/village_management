"use client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileUpload } from "@/components/ui/file-upload";
export default function NewCorrectionPage() {
  const router = useRouter();
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">ส่งคำขอแก้ไขข้อมูล</h1>
      <form onSubmit={(e) => { e.preventDefault(); router.push("/resident/household/corrections"); }} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <Input label="หัวข้อการแก้ไข" placeholder="เช่น แก้ไขชื่อสมาชิก" required />
        <Textarea label="รายละเอียด" placeholder="อธิบายข้อมูลที่ต้องการแก้ไข..." required />
        <FileUpload label="เอกสารหลักฐาน" accept=".pdf,.jpg,.png" multiple />
        <Button type="submit">ส่งคำขอ</Button>
      </form>
    </div>
  );
}
