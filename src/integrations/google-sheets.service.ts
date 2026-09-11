/**
 * ====================================================================================
 * GOOGLE SHEETS API INTEGRATION
 * ====================================================================================
 * NOTE: This integration is currently dormant / inactive because real credentials
 * (GOOGLE_SERVICE_ACCOUNT_JSON and GOOGLE_SHEET_ID) have not been configured yet.
 * Once real credentials are supplied as environment variables, this service will
 * automatically append rows to Google Sheets using official googleapis Service Account.
 * ====================================================================================
 */

import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { google } from "googleapis";

@Injectable()
export class GoogleSheetsService {
  private readonly logger = new Logger(GoogleSheetsService.name);

  private get credentials() {
    const jsonStr = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
    const sheetId = process.env.GOOGLE_SHEET_ID?.trim();

    if (!jsonStr || !sheetId) {
      return { isConfigured: false, sheetId: undefined, credentials: undefined };
    }

    try {
      const credentials = JSON.parse(jsonStr);
      return { isConfigured: true, sheetId, credentials };
    } catch {
      this.logger.warn("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON.");
      return { isConfigured: false, sheetId: undefined, credentials: undefined };
    }
  }

  /**
   * Appends a row of values to the configured Google Sheet.
   * If credentials are missing, logs a warning and fails gracefully.
   */
  async appendRow(values: string[]): Promise<{ success: boolean; updatedRange?: string }> {
    const { isConfigured, sheetId, credentials } = this.credentials;

    if (!isConfigured || !sheetId || !credentials) {
      this.logger.warn(
        "Google Sheets API credentials (GOOGLE_SERVICE_ACCOUNT_JSON, GOOGLE_SHEET_ID) are missing or invalid. Skipping append.",
      );
      return { success: false };
    }

    try {
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });

      const sheets = google.sheets({ version: "v4", auth });

      const response = await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: "Sheet1!A1",
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [values],
        },
      });

      const updatedRange = response.data.updates?.updatedRange ?? undefined;
      this.logger.log(`Appended row to Google Sheet ${sheetId} (Range: ${updatedRange ?? "N/A"})`);

      return { success: true, updatedRange };
    } catch (error) {
      this.logger.error("Failed to append row to Google Sheet", error);
      throw new BadRequestException("Failed to append row to Google Sheet due to API or credential error");
    }
  }

  /**
   * Test Google Sheets endpoint callback.
   * Throws BadRequestException if credentials are missing to explicitly notify admin UI.
   */
  async sendTestRow(customRowData?: string[]) {
    const { isConfigured } = this.credentials;

    if (!isConfigured) {
      this.logger.warn("Google Sheets test requested but credentials are not configured.");
      throw new BadRequestException(
        "Google Sheets API credentials are not configured. Please set GOOGLE_SERVICE_ACCOUNT_JSON and GOOGLE_SHEET_ID.",
      );
    }

    const rowValues = customRowData && customRowData.length > 0
      ? customRowData
      : [new Date().toISOString(), "Test Integration Entry", "RIVÉ Backend", "STATUS_OK"];

    return this.appendRow(rowValues);
  }
}
