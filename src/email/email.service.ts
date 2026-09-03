import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly client = new Resend(process.env.EMAIL_PROVIDER_API_KEY);

  async sendVerificationEmail(email: string, token: string) {
    const url = `${process.env.FRONTEND_URL ?? 'http://localhost:3001'}/verify-email?token=${encodeURIComponent(token)}`;
    await this.send(email, 'Verify your RIVÉ email address', `<p>Verify your email address by opening <a href="${url}">this link</a>.</p>`, `Verify your email address: ${url}`);
  }

  async sendPasswordResetEmail(email: string, token: string) {
    const url = `${process.env.FRONTEND_URL ?? 'http://localhost:3001'}/reset-password?token=${encodeURIComponent(token)}`;
    await this.send(email, 'Reset your RIVÉ password', `<p>Reset your password by opening <a href="${url}">this link</a>. It expires in one hour.</p>`, `Reset your password: ${url}`);
  }

  private async send(to: string, subject: string, html: string, text: string) {
    const result = await this.client.emails.send({
      from: process.env.EMAIL_FROM_ADDRESS!,
      to,
      subject,
      html,
      text,
    });
    if (result.error) throw new Error(`Email delivery failed: ${result.error.message}`);
  }
}
