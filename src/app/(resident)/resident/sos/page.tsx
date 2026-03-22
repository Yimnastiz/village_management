"use client";
import { useState } from "react";
import { Siren } from "lucide-react";
export default function SOSPage() {
  const [sent, setSent] = useState(false);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">SOS ฉุกเฉิน</h1>
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center space-y-4">
        <p className="text-gray-500 text-sm">กดปุ่มด้านล่างหากต้องการแจ้งเหตุฉุกเฉิน</p>
        {sent ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-red-700 font-semibold">ส่งสัญญาณฉุกเฉินแล้ว!</p>
            <p className="text-red-600 text-sm mt-1">ทีมงานจะติดต่อกลับโดยเร็ว</p>
          </div>
        ) : (
          <button onClick={() => setSent(true)} className="w-32 h-32 rounded-full bg-red-600 hover:bg-red-700 text-white flex flex-col items-center justify-center gap-2 mx-auto shadow-lg active:scale-95 transition-transform">
            <Siren className="h-8 w-8" />
            <span className="font-bold text-sm">SOS</span>
          </button>
        )}
        <p className="text-xs text-gray-400">สายด่วนฉุกเฉิน: 1669</p>
      </div>
    </div>
  );
}
