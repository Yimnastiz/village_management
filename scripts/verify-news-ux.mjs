import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [constants, publicList, publicToolbar, publicDetail, adminDetail, actions, requestDetail, deleteButton] = await Promise.all([
  read("../src/lib/constants.ts"),
  read("../src/app/(public-village)/[villageSlug]/news/page.tsx"),
  read("../src/app/(public-village)/[villageSlug]/news/public-news-toolbar.tsx"),
  read("../src/app/(public-village)/[villageSlug]/news/[newsId]/page.tsx"),
  read("../src/app/(admin)/admin/news/[newsId]/page.tsx"),
  read("../src/app/(admin)/admin/news/actions.ts"),
  read("../src/app/(admin)/admin/news/requests/[requestId]/page.tsx"),
  read("../src/app/(admin)/admin/news/requests/request-delete-button.tsx"),
]);

assert.match(constants, /ADMIN: "โดยผู้ใหญ่บ้าน"/);
assert.match(publicList, /query\.source === "headman" \|\| query\.source === "resident"/);
assert.match(publicList, /role: "HEADMAN"/);
assert.match(publicList, /accountKind: "RESIDENT_HOUSE"/);
assert.match(publicList, /role: "RESIDENT"/);
assert.match(publicToolbar, /label="แหล่งที่มา"/);
assert.match(publicToolbar, /Number\(sort !== "newest"\) \+ Number\(source !== "all"\)/);
assert.match(publicDetail, /mx-auto w-full max-w-4xl/);
assert.match(publicDetail, /thumbnailBehavior="select"/);
assert.match(publicDetail, /formatNewsAuthor\(news\.author\.name, "HEADMAN"\)/);
assert.match(publicDetail, /border-t border-gray-100/);
assert.match(adminDetail, /border-t border-gray-100/);

const deleteAction = actions.slice(actions.indexOf("export async function adminDeleteNewsSubmissionAction"), actions.indexOf("export async function adminRejectNewsSubmissionAction"));
assert.match(deleteAction, /status: "PENDING"/);
assert.match(deleteAction, /requireActionReason\("content\.delete"/);
assert.match(deleteAction, /await tx\.newsSubmission\.delete/);
assert.doesNotMatch(deleteAction, /tx\.news\.delete/);
assert.match(deleteAction, /userId: submission\.requesterId/);
assert.match(deleteAction, /actionName: "NEWS_SUBMISSION_DELETED"/);
assert.match(requestDetail, /request\.status === "PENDING"[\s\S]*NewsRequestDeleteButton/);
assert.match(deleteButton, /router\.push\("\/admin\/news\/requests"\)/);
assert.match(deleteButton, /title="ลบคำขอข่าว"/);

console.log("Public News source/filter/detail and Pending News request deletion checks passed.");
