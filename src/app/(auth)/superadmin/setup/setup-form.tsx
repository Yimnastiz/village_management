"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createFirstSuperAdminAction, type FirstSuperAdminActionState } from "./actions";

const initialState: FirstSuperAdminActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" className="w-full" isLoading={pending}>สร้าง Super Admin</Button>;
}

export function FirstSuperAdminSetupForm() {
  const [state, formAction] = useActionState(createFirstSuperAdminAction, initialState);
  return (
    <form action={formAction} className="mt-6 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="ชื่อ" name="firstName" autoComplete="given-name" required />
        <Input label="นามสกุล" name="lastName" autoComplete="family-name" required />
      </div>
      <Input label="เบอร์โทรศัพท์" name="phoneNumber" type="tel" inputMode="numeric" placeholder="0812345678" autoComplete="tel" required />
      <Input label="อีเมล (ไม่บังคับ)" name="email" type="email" autoComplete="email" />
      <Input label="รหัสติดตั้ง" name="bootstrapSecret" type="password" autoComplete="off" required />
      {state.error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{state.error}</p> : null}
      <SubmitButton />
    </form>
  );
}
