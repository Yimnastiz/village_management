"use client";
import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";

const mockVillages = [
  { id: "1", slug: "ban-nong-khai", name: "หมู่บ้านหนองไคร" },
  { id: "2", slug: "ban-sai-ngam", name: "หมู่บ้านสายงาม" },
];

export default function SelectVillagePage() {
  const router = useRouter();
  return (
    <div className="bg-white rounded-2xl shadow-lg p-8">
      <h2 className="text-xl font-bold text-gray-900 mb-2">เลือกหมู่บ้าน</h2>
      <p className="text-sm text-gray-500 mb-6">คุณมีสมาชิกภาพในหลายหมู่บ้าน กรุณาเลือก</p>
      <div className="space-y-3">
        {mockVillages.map((v) => (
          <button
            key={v.id}
            onClick={() => router.push("/resident/dashboard")}
            className="w-full flex items-center gap-3 p-4 border border-gray-200 rounded-xl hover:border-green-500 hover:bg-green-50 transition-colors text-left"
          >
            <div className="p-2 bg-green-50 rounded-lg">
              <MapPin className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">{v.name}</p>
              <p className="text-xs text-gray-400">{v.slug}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
