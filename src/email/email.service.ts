import { Injectable, Logger } from '@nestjs/common';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/**
 * Sends transactional email via the Resend HTTP API (https://resend.com/docs/api-reference/emails/send-email).
 * Uses the Node 20+ global `fetch` instead of an SDK dependency to keep the footprint small.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly apiKey = process.env.EMAIL_PROVIDER_API_KEY;
  private readonly fromAddress = process.env.EMAIL_FROM_ADDRESS;

  async send(options: SendEmailOptions): Promise<void> {
    if (!this.apiKey || !this.fromAddress) {
      this.logger.warn(`Email provider is not configured; skipped sending "${options.subject}" to ${options.to}.`);
      return;
    }

    const authorizationHeader = ['Bearer', this.apiKey].join(' ');
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: authorizationHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.fromAddress,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.error(`Failed to send email to ${options.to}: ${response.status} ${body}`);
      throw new Error(`Failed to send email (status ${response.status})`);
    }
  }

  buildEmailVerificationEmail(link: string): Pick<SendEmailOptions, 'subject' | 'html' | 'text'> {
    return {
      subject: 'Verify your RIVÉ account',
      html: `<p>Welcome to RIVÉ.</p><p>Please confirm your email address by clicking the link below:</p><p><a href="${link}">${link}</a></p><p>This link expires in 24 hours. If you did not create this account, you can ignore this email.</p>`,
      text: `Welcome to RIVE.\n\nPlease confirm your email address by visiting: ${link}\n\nThis link expires in 24 hours. If you did not create this account, you can ignore this email.`,
    };
  }

  buildPasswordResetEmail(link: string): Pick<SendEmailOptions, 'subject' | 'html' | 'text'> {
    return {
      subject: 'Reset your RIVÉ password',
      html: `<p>We received a request to reset your RIVÉ account password.</p><p>Click the link below to choose a new password:</p><p><a href="${link}">${link}</a></p><p>This link expires in 1 hour. If you did not request this, you can safely ignore this email.</p>`,
      text: `We received a request to reset your RIVE account password.\n\nVisit this link to choose a new password: ${link}\n\nThis link expires in 1 hour. If you did not request this, you can safely ignore this email.`,
    };
  }
}
