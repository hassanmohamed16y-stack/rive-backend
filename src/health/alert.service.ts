import { Injectable, Logger } from "@nestjs/common";
import { EmailService } from "../email/email.service";

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);
  private readonly lastAlertTimestamps = new Map<string, number>();
  private readonly ALERT_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes

  constructor(private readonly emailService: EmailService) {}

  async sendAlert(
    alertKey: string,
    subject: string,
    details: string,
  ): Promise<boolean> {
    const adminAlertEmail = process.env.ADMIN_ALERT_EMAIL?.trim();
    if (!adminAlertEmail) {
      this.logger.debug(
        `ADMIN_ALERT_EMAIL is not configured. Alert '${alertKey}' skipped.`,
      );
      return false;
    }

    const now = Date.now();
    const lastSent = this.lastAlertTimestamps.get(alertKey) ?? 0;

    if (now - lastSent < this.ALERT_COOLDOWN_MS) {
      this.logger.warn(
        `Alert '${alertKey}' throttled. Cooldown in effect (last sent ${Math.round((now - lastSent) / 1000)}s ago).`,
      );
      return false;
    }

    this.lastAlertTimestamps.set(alertKey, now);

    const emailSubject = `[RIVÉ ALERT] ${subject}`;
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #d9534f;">🚨 System Monitoring Alert</h2>
        <p><strong>Alert Type:</strong> ${alertKey}</p>
        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        <hr style="border: 0; border-top: 1px solid #eee;" />
        <h3>Details:</h3>
        <pre style="background: #f8f9fa; padding: 15px; border-radius: 5px; white-space: pre-wrap;">${details}</pre>
        <p style="font-size: 12px; color: #777;">Note: Identical alerts are throttled to maximum 1 per 15 minutes.</p>
      </div>
    `;

    try {
      await this.emailService.sendEmail({
        to: adminAlertEmail,
        subject: emailSubject,
        html,
        text: `[RIVÉ ALERT] ${subject}\n\nAlert Type: ${alertKey}\nTimestamp: ${new Date().toISOString()}\n\nDetails:\n${details}`,
      });
      this.logger.log(`Alert '${alertKey}' email sent successfully to ${adminAlertEmail}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send alert email for '${alertKey}' to ${adminAlertEmail}`,
        error instanceof Error ? error.stack : String(error),
      );
      return false;
    }
  }

  // Clear timestamp cache (useful for testing)
  resetCooldowns(): void {
    this.lastAlertTimestamps.clear();
  }
}
