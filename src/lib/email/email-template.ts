import type { EmailOtpPurpose } from "@prisma/client";

const PRODUCT_NAME_TH = "ระบบบริหารจัดการข้อมูลพื้นฐานของหมู่บ้าน";

const PURPOSE_COPY: Record<EmailOtpPurpose, string> = {
  HOUSE_OPENING: "รหัสยืนยันอีเมลสำหรับขอเปิดบัญชีบ้าน",
  HOUSE_LOGIN: "รหัสเข้าสู่ระบบบัญชีบ้าน",
  ADD_HOUSE_EMAIL: "รหัสยืนยันเพื่อเพิ่มอีเมลเข้าสู่บัญชีบ้าน",
  HEADMAN_LOGIN: "รหัสเข้าสู่ระบบผู้ใหญ่บ้าน",
  ACCOUNT_RECOVERY: "รหัสยืนยันการกู้คืนบัญชี",
};

export type EmailOtpTemplate = {
  subject: string;
  text: string;
  html: string;
};

export function buildEmailOtpTemplate(input: {
  code: string;
  purpose: EmailOtpPurpose;
  ttlSeconds: number;
}): EmailOtpTemplate {
  const purposeLabel = PURPOSE_COPY[input.purpose];
  const ttlMinutes = Math.max(1, Math.ceil(input.ttlSeconds / 60));
  const subject = `${purposeLabel} — ${PRODUCT_NAME_TH}`;
  const text = [
    purposeLabel,
    "",
    "รหัสยืนยันของคุณคือ",
    "",
    input.code,
    "",
    `รหัสนี้มีอายุ ${ttlMinutes} นาที`,
    "หากคุณไม่ได้เป็นผู้ดำเนินการ กรุณาไม่ต้องดำเนินการใด ๆ",
  ].join("\n");
  const html = [
    '<div style="font-family:Tahoma,Arial,sans-serif;color:#172033;line-height:1.7">',
    `<p>${purposeLabel}</p>`,
    '<p style="margin-bottom:8px">รหัสยืนยันของคุณคือ</p>',
    `<p style="font-size:30px;font-weight:700;letter-spacing:8px;margin:8px 0 20px">${input.code}</p>`,
    `<p>รหัสนี้มีอายุ ${ttlMinutes} นาที</p>`,
    "<p>หากคุณไม่ได้เป็นผู้ดำเนินการ กรุณาไม่ต้องดำเนินการใด ๆ</p>",
    "</div>",
  ].join("");
  return { subject, text, html };
}
