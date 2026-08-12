"use server";

export type FirstSuperAdminActionState = { error?: string };

// Retained only so an old client bundle cannot create a User SuperAdmin.
export async function createFirstSuperAdminAction(): Promise<FirstSuperAdminActionState> {
  return { error: "ระบบ Super Admin ใช้รหัสจาก ENV และไม่สร้างบัญชีผู้ใช้" };
}
