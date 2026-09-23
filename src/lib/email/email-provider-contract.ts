import type { EmailOtpPurpose } from "@prisma/client";

export type SendOtpEmailInput = {
  to: string;
  code: string;
  purpose: EmailOtpPurpose;
  ttlSeconds: number;
};

export type SendEmailMessageInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export interface EmailProvider {
  sendOtp(input: SendOtpEmailInput): Promise<void>;
  sendMessage(input: SendEmailMessageInput): Promise<void>;
}

/** Test-only provider. It performs no network I/O. */
export class InMemoryEmailProvider implements EmailProvider {
  readonly deliveries: SendOtpEmailInput[] = [];
  readonly messages: SendEmailMessageInput[] = [];
  private readonly failure: Error | null;

  constructor(failure: Error | null = null) {
    this.failure = failure;
  }

  async sendOtp(input: SendOtpEmailInput): Promise<void> {
    if (this.failure) throw this.failure;
    this.deliveries.push({ ...input });
  }

  async sendMessage(input: SendEmailMessageInput): Promise<void> {
    if (this.failure) throw this.failure;
    this.messages.push({ ...input });
  }
}

export async function sendOtpEmail(
  provider: EmailProvider,
  input: SendOtpEmailInput,
): Promise<void> {
  await provider.sendOtp(input);
}

export async function sendEmailMessage(
  provider: EmailProvider,
  input: SendEmailMessageInput,
): Promise<void> {
  await provider.sendMessage(input);
}
