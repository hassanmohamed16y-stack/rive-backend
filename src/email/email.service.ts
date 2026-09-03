import { Injectable, Logger } from '@nestjs/common';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Thin wrapper around the Resend HTTP API (https://resend.com/docs/api-reference/emails/send-email).
 * Uses the platform `fetch` (available on Node 18+) instead of an SDK dependency.
 *
 * In every test run this service must be mocked (see auth.service.spec.ts / auth.controller e2e
 * specs) so that `npm test` never performs a real HTTP request.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly apiKey = process.env.EMAIL_PROVIDER_API_KEY;
  private readonly fromAddress = process.env.EMAIL_FROM_ADDRESS ?? 'no-reply@example.com';
  private readonly apiUrl = process.env.EMAIL_PROVIDER_API_URL ?? 'https://api.resend.com/emails';

  async sendEmail(options: SendEmailOptions): Promise<void> {
    if (!this.apiKey) {
      // Local development/test environments may not have an email provider configured.
      // Log instead of throwing so the calling flow (register/forgot-password/etc.) still succeeds.
      this.logger.warn(`EMAIL_PROVIDER_API_KEY is not set; skipping email send to ${options.to} (${options.subject}).`);
      return;
    }

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.fromAddress,
        to: [options.to],
        subject: options.subject,
        html: options.html,
        ...(options.text ? { text: options.text } : {}),
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.error(`Failed to send email to ${options.to}: ${response.status} ${body}`);
      throw new Error(`Email provider request failed with status ${response.status}`);
    }
  }

  async sendPasswordResetEmail(to: string, resetToken: string): Promise<void> {
    await this.sendEmail({
      to,
      subject: 'Reset your RIVÉ password',
      html: `<p>Use the following token to reset your password. It expires in 1 hour.</p><p><strong>${resetToken}</strong></p>`,
      text: `Use the following token to reset your password (expires in 1 hour): ${resetToken}`,
    });
  }

  async sendEmailVerificationEmail(to: string, verificationToken: string): Promise<void> {
    await this.sendEmail({
      to,
      subject: 'Verify your RIVÉ email address',
      html: `<p>Use the following token to verify your email address.</p><p><strong>${verificationToken}</strong></p>`,
      text: `Use the following token to verify your email address: ${verificationToken}`,
    });
  }
}
