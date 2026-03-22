"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";

const ratings = [
  { value: "VERY_SATISFIED", label: "พึงพอใจมาก", stars: 5 },
  { value: "SATISFIED", label: "พึงพอใจ", stars: 4 },
  { value: "NEUTRAL", label: "เฉยๆ", stars: 3 },
  { value: "DISSATISFIED", label: "ไม่พึงพอใจ", stars: 2 },
  { value: "VERY_DISSATISFIED", label: "ไม่พึงพอใจมาก", stars: 1 },
];

export default function IssueFeedbackPage() {
  const [selected, setSelected] = useState("");
  const router = useRouter();
  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">ให้คะแนนบริการ</h1>
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <p className="text-sm text-gray-600">คุณพึงพอใจกับการแก้ไขปัญหาครั้งนี้แค่ไหน?</p>
        <div className="space-y-2">
          {ratings.map((r) => (
            <button
              key={r.value}
              onClick={() => setSelected(r.value)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-colors ${selected === r.value ? "border-green-500 bg-green-50" : "border-gray-200 hover:border-gray-300"}`}
            >
              <div className="flex">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`h-4 w-4 ${i < r.stars ? "text-yellow-400 fill-yellow-400" : "text-gray-200 fill-gray-200"}`} />
                ))}
              </div>
              <span className="text-sm font-medium">{r.label}</span>
            </button>
          ))}
        </div>
        <Textarea label="ความคิดเห็น (ไม่บังคับ)" placeholder="แสดงความคิดเห็นเพิ่มเติม..." />
        <Button className="w-full" onClick={() => router.push("/resident/issues")} disabled={!selected}>
          ส่งคะแนน
        </Button>
      </div>
    </div>
  );
}
