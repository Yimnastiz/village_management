import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TransparencyForm } from "../transparency-form";

export default function NewTransparencyPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/transparency" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">สร้างรายการความโปร่งใส</h1>
      </div>
      <TransparencyForm mode="create" />
    </div>
  );
}
