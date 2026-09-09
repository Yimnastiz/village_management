import test from "node:test";
import assert from "node:assert/strict";
import {
  getCanonicalDownloadMimeType,
  isAllowedDownloadFile,
} from "../src/lib/download-upload.ts";

test("download uploads allow browser MIME fallbacks only for permitted extensions", () => {
  const accepted = [
    ["report.pdf", "application/pdf"],
    ["letter.doc", "application/octet-stream"],
    ["letter.docx", ""],
    ["sheet.xls", "application/vnd.ms-excel.sheet.8"],
    ["slides.ppt", "application/vnd.ms-powerpoint.presentation.8"],
    ["photo.jpg", "image/pjpeg"],
  ];

  for (const [fileName, mimeType] of accepted) {
    assert.equal(isAllowedDownloadFile(fileName, mimeType), true, `${fileName} should be accepted`);
    assert.ok(getCanonicalDownloadMimeType(fileName, mimeType));
  }

  assert.equal(isAllowedDownloadFile("payload.exe", "application/octet-stream"), false);
  assert.equal(isAllowedDownloadFile("report.pdf", "image/png"), false);
});
