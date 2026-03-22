import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NewsForm } from "../news-form";

export default function NewNewsPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/news" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">สร้างข่าวใหม่</h1>
      </div>
      <NewsForm mode="create" />
    </div>
  );
}
