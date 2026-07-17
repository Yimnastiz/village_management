export function isDevOtpBypassEnabled(): boolean {
  return process.env.NODE_ENV === "development" && process.env.DEV_BYPASS_OTP === "true";
}

export function getDevOtpCode(): string {
  return process.env.DEV_OTP_CODE?.trim() || "000000";
}
