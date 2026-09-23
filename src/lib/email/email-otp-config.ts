type Environment = Record<string, string | undefined>;

export type EmailOtpConfig = {
  ttlSeconds: number;
  maxAttempts: number;
  resendSeconds: number;
  maxResends: number;
  rateWindowSeconds: number;
  maxRequestsPerEmail: number;
  maxRequestsPerIp: number;
  hashSecret: string;
};

function integerSetting(
  environment: Environment,
  name: string,
  fallback: number,
  limits: { min: number; max: number },
): number {
  const raw = environment[name]?.trim();
  if (!raw) return fallback;
  if (!/^\d+$/.test(raw)) throw new Error(`${name} must be an integer.`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < limits.min || value > limits.max) {
    throw new Error(`${name} must be between ${limits.min} and ${limits.max}.`);
  }
  return value;
}

export function readEmailOtpConfig(
  environment: Environment = process.env,
  nodeEnvironment = process.env.NODE_ENV ?? "development",
): EmailOtpConfig {
  const explicitSecret = environment.EMAIL_OTP_HASH_SECRET?.trim();
  const developmentFallback = environment.BETTER_AUTH_SECRET?.trim();
  const hashSecret = explicitSecret || (nodeEnvironment === "production" ? "" : developmentFallback);

  if (!hashSecret) {
    throw new Error(
      nodeEnvironment === "production"
        ? "EMAIL_OTP_HASH_SECRET is required in production."
        : "EMAIL_OTP_HASH_SECRET or BETTER_AUTH_SECRET is required for Email OTP hashing.",
    );
  }
  if (nodeEnvironment === "production" && hashSecret.length < 32) {
    throw new Error("EMAIL_OTP_HASH_SECRET must be at least 32 characters in production.");
  }

  return {
    ttlSeconds: integerSetting(environment, "EMAIL_OTP_TTL_SECONDS", 300, { min: 60, max: 1800 }),
    maxAttempts: integerSetting(environment, "EMAIL_OTP_MAX_ATTEMPTS", 5, { min: 1, max: 10 }),
    resendSeconds: integerSetting(environment, "EMAIL_OTP_RESEND_SECONDS", 60, { min: 10, max: 600 }),
    maxResends: integerSetting(environment, "EMAIL_OTP_MAX_RESENDS", 5, { min: 0, max: 10 }),
    rateWindowSeconds: integerSetting(environment, "EMAIL_OTP_RATE_WINDOW_SECONDS", 900, { min: 60, max: 86400 }),
    maxRequestsPerEmail: integerSetting(environment, "EMAIL_OTP_MAX_REQUESTS_PER_EMAIL", 5, { min: 1, max: 50 }),
    maxRequestsPerIp: integerSetting(environment, "EMAIL_OTP_MAX_REQUESTS_PER_IP", 20, { min: 1, max: 200 }),
    hashSecret,
  };
}
