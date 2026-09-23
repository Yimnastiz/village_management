type Environment = Record<string, string | undefined>;

export type ConsoleEmailProviderConfig = {
  provider: "console";
  nodeEnvironment: string;
};

export type SmtpEmailProviderConfig = {
  provider: "smtp";
  host: string;
  port: number;
  secure: boolean;
  user: string | null;
  password: string | null;
  from: string;
  replyTo: string | null;
};

export type EmailProviderConfig = ConsoleEmailProviderConfig | SmtpEmailProviderConfig;

function required(environment: Environment, name: string): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required when EMAIL_PROVIDER=smtp.`);
  return value;
}

function smtpPort(environment: Environment): number {
  const raw = environment.SMTP_PORT?.trim() || "587";
  if (!/^\d+$/.test(raw)) throw new Error("SMTP_PORT must be an integer.");
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 1 || value > 65535) {
    throw new Error("SMTP_PORT must be between 1 and 65535.");
  }
  return value;
}

function smtpSecure(environment: Environment): boolean {
  const raw = environment.SMTP_SECURE?.trim().toLocaleLowerCase("en-US") || "false";
  if (raw !== "true" && raw !== "false") throw new Error("SMTP_SECURE must be true or false.");
  return raw === "true";
}

export function readEmailProviderConfig(
  environment: Environment = process.env,
  nodeEnvironment = process.env.NODE_ENV ?? "development",
): EmailProviderConfig {
  const configuredProvider = environment.EMAIL_PROVIDER?.trim().toLocaleLowerCase("en-US");
  const provider = configuredProvider || (nodeEnvironment === "production" ? "" : "console");

  if (provider === "console") {
    if (nodeEnvironment === "production") {
      throw new Error("EMAIL_PROVIDER=console is forbidden in production.");
    }
    return { provider, nodeEnvironment };
  }

  if (provider !== "smtp") {
    throw new Error("EMAIL_PROVIDER must be smtp in production or console in non-production environments.");
  }

  const user = environment.SMTP_USER?.trim() || null;
  const password = environment.SMTP_PASSWORD?.trim() || null;
  if (Boolean(user) !== Boolean(password)) {
    throw new Error("SMTP_USER and SMTP_PASSWORD must either both be set or both be omitted.");
  }

  return {
    provider,
    host: required(environment, "SMTP_HOST"),
    port: smtpPort(environment),
    secure: smtpSecure(environment),
    user,
    password,
    from: required(environment, "EMAIL_FROM"),
    replyTo: environment.EMAIL_REPLY_TO?.trim() || null,
  };
}
