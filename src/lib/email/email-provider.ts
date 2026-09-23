import nodemailer from "nodemailer";
import { maskEmail } from "@/lib/account-email";
import { buildEmailOtpTemplate } from "./email-template";
import type { EmailProvider, SendEmailMessageInput, SendOtpEmailInput } from "./email-provider-contract";
import {
  readEmailProviderConfig,
  type EmailProviderConfig,
  type SmtpEmailProviderConfig,
} from "./email-provider-config";

export type { EmailProvider, SendEmailMessageInput, SendOtpEmailInput } from "./email-provider-contract";
export { InMemoryEmailProvider, sendEmailMessage, sendOtpEmail } from "./email-provider-contract";

export class ConsoleEmailProvider implements EmailProvider {
  constructor(private readonly nodeEnvironment: string) {
    this.assertNonProduction();
  }

  private assertNonProduction(): void {
    if (this.nodeEnvironment === "production" || process.env.NODE_ENV === "production") {
      throw new Error("Console Email OTP delivery is forbidden in production.");
    }
  }

  async sendOtp(input: SendOtpEmailInput): Promise<void> {
    this.assertNonProduction();
    console.log("[EMAIL OTP DEV]", {
      to: maskEmail(input.to),
      purpose: input.purpose,
      code: input.code,
      ttlSeconds: input.ttlSeconds,
    });
  }

  async sendMessage(input: SendEmailMessageInput): Promise<void> {
    this.assertNonProduction();
    console.log("[EMAIL MESSAGE DEV]", {
      to: maskEmail(input.to),
      subject: input.subject,
    });
  }
}

export class SmtpEmailProvider implements EmailProvider {
  private readonly transport;

  constructor(private readonly config: SmtpEmailProviderConfig) {
    this.transport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.user && config.password
        ? { user: config.user, pass: config.password }
        : undefined,
    });
  }

  async sendOtp(input: SendOtpEmailInput): Promise<void> {
    const template = buildEmailOtpTemplate(input);
    await this.transport.sendMail({
      from: this.config.from,
      to: input.to,
      replyTo: this.config.replyTo ?? undefined,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });
  }

  async sendMessage(input: SendEmailMessageInput): Promise<void> {
    await this.transport.sendMail({
      from: this.config.from,
      to: input.to,
      replyTo: this.config.replyTo ?? undefined,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
  }
}

export function createEmailProvider(config: EmailProviderConfig): EmailProvider {
  return config.provider === "console"
    ? new ConsoleEmailProvider(config.nodeEnvironment)
    : new SmtpEmailProvider(config);
}

export function getEmailProvider(): EmailProvider {
  return createEmailProvider(readEmailProviderConfig());
}
