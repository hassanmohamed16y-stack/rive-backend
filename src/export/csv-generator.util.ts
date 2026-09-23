import * as ExcelJS from "exceljs";

export interface ColumnDefinition {
  header: string;
  key: string;
  width?: number;
}

export async function generateCsvReport(
  sheetName: string,
  columns: ColumnDefinition[],
  rows: Record<string, any>[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = columns;

  for (const row of rows) {
    sheet.addRow(row);
  }

  const buffer = await workbook.csv.writeBuffer();
  return Buffer.from(buffer);
}
