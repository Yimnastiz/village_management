import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("pending exit clears only opening access and preserves the request", async () => {
  const route = await read("../src/app/api/auth/pending-resident/exit/route.ts");
  const button = await read("../src/components/layout/pending-exit-button.tsx");
  assert.match(route, /clearHouseOpeningAccessCookie\(response\)/u);
  assert.doesNotMatch(route, /signOutCurrentSession|houseAccountOpeningRequest\.update|delete/u);
  assert.match(button, /pending-resident\/exit/u);
  assert.match(button, /window\.location\.replace\("\/auth\/login"\)/u);
});

test("active logout remains separate from pending exit", async () => {
  const topBar = await read("../src/components/layout/top-bar.tsx");
  assert.match(topBar, /isPendingResident \? <PendingExitButton \/> : <LogoutButton mode="menu" \/>/u);
  assert.match(topBar, /PendingExitButton \/> : <LogoutButton mode="menu" \/>/u);
});

test("pending profile and notification dropdown items open the existing locked dialog", async () => {
  const topBar = await read("../src/components/layout/top-bar.tsx");
  assert.match(topBar, /event\.preventDefault\(\);[\s\S]*?setProfileMenuOpen\(false\);[\s\S]*?setLockedMenuLabel\("โปรไฟล์ผู้ใช้"\)/u);
  assert.match(topBar, /event\.preventDefault\(\);[\s\S]*?setProfileMenuOpen\(false\);[\s\S]*?setLockedMenuLabel\("การแจ้งเตือน"\)/u);
  assert.match(topBar, /<LockedResidentMenuDialog/u);
});

test("pending dashboard keeps request data read-only and shows the submitted phone", async () => {
  const [access, dashboard, sidebar] = await Promise.all([
    read("../src/lib/pending-resident-access.ts"),
    read("../src/components/resident/pending-resident-dashboard.tsx"),
    read("../src/components/layout/resident-sidebar.tsx"),
  ]);
  assert.match(access, /contactPhone: true/u);
  assert.match(access, /contactPhone: openingRequest\.contactPhone/u);
  assert.match(dashboard, /เบอร์โทรศัพท์ติดต่อ/u);
  assert.match(dashboard, /เมนูที่ใช้งานได้/u);
  assert.match(dashboard, /บริการสมาชิกจะพร้อมใช้งานหลังผู้ใหญ่บ้านอนุมัติคำขอ/u);
  assert.doesNotMatch(dashboard, /แก้ไข|resend|ส่งรหัส/u);
  assert.doesNotMatch(sidebar, /กำลังตรวจสอบคำขอ/u);
});
