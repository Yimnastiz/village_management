import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [reviewSource, detailSource, editSource, modalSource, eventDetailSource, actionSource] = await Promise.all([
  read("../src/app/(admin)/admin/calendar/requests/request-review-buttons.tsx"),
  read("../src/app/(admin)/admin/calendar/requests/[requestId]/page.tsx"),
  read("../src/app/(admin)/admin/calendar/requests/[requestId]/edit/page.tsx"),
  read("../src/app/(admin)/admin/calendar/admin-event-modal.tsx"),
  read("../src/app/(admin)/admin/calendar/[eventId]/page.tsx"),
  read("../src/app/(admin)/admin/calendar/actions.ts"),
]);

assert.match(eventDetailSource, /PageBackLink href="\/admin\/calendar" label="กลับปฏิทิน"/);
assert.match(modalSource, /closeOnBackdrop=\{false\}/);
assert.match(modalSource, /closeOnEscape=\{false\}/);
assert.doesNotMatch(modalSource, />ยกเลิก</);

assert.doesNotMatch(detailSource, /CalendarRequestManagementActions/);
assert.match(editSource, /redirect\(`\/admin\/calendar\/requests\/\$\{requestId\}`\)/);
assert.equal(actionSource.match(/คำขอของสมาชิกสามารถอนุมัติหรือไม่อนุมัติได้เท่านั้น/g)?.length, 2);
assert.match(reviewSource, /<VisibilitySelector/);
assert.match(reviewSource, /defaultValues: \{ finalVisibility: requestedVisibility \}/);
assert.match(reviewSource, /adminApproveVillageEventSubmissionAction\(requestId, "", finalVisibility\)/);
assert.match(reviewSource, /adminRejectVillageEventSubmissionAction\(requestId, reason\)/);
assert.match(reviewSource, /invalidReasonMessage="กรุณาระบุเหตุผลที่ไม่อนุมัติ"/);
assert.doesNotMatch(reviewSource, /หมายเหตุถึงผู้ส่งคำขอ/);

console.log("Calendar request review and modal dismissal checks passed.");
