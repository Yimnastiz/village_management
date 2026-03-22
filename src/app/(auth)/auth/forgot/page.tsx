"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";

export default function ForgotPage() {
  const [sent, setSent] = useState(false);
  return (
    <div className="bg-white rounded-2xl shadow-lg p-8">
      <h2 className="text-xl font-bold text-gray-900 mb-2">กู้คืนบัญชี</h2>
      <p className="text-sm text-gray-500 mb-6">ใส่เบอร์โทรศัพท์ที่ลงทะเบียนไว้</p>
      {sent ? (
        <div className="text-center py-4">
          <p className="text-green-600 font-medium">ส่ง OTP ไปแล้ว!</p>
          <Link href="/auth/verify-otp" className="text-green-600 hover:underline text-sm mt-2 block">
            ยืนยัน OTP
          </Link>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); setSent(true); }} className="space-y-4">
          <Input label="เบอร์โทรศัพท์" type="tel" placeholder="0812345678" required />
          <Button type="submit" className="w-full">ส่ง OTP</Button>
        </form>
      )}
      <div className="mt-4 text-center">
        <Link href="/auth/login" className="text-sm text-green-600 hover:underline">
          กลับไปหน้าเข้าสู่ระบบ
        </Link>
      </div>
    </div>
  );
}
