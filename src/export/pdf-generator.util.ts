import PDFDocument from "pdfkit";

export interface PdfReportOptions {
  title: string;
  headers: string[];
  rows: (string | number)[][];
  footerText?: string;
}

export function generatePdfReport(options: PdfReportOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 30,
        size: "A4",
        layout: "landscape",
      });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err) => reject(err));

      // Title
      doc.fontSize(16).text(options.title, { align: "center" });
      doc.moveDown(1);

      const startX = 30;
      let startY = doc.y;
      const pageWidth = doc.page.width - 60;
      const colWidth = pageWidth / options.headers.length;
      const rowHeight = 22;

      // Draw header row background
      doc.rect(startX, startY, pageWidth, rowHeight).fill("#EAEAEA");
      doc.fillColor("#000000").fontSize(9);

      // Draw header text
      options.headers.forEach((header, idx) => {
        doc.text(header, startX + idx * colWidth + 4, startY + 6, {
          width: colWidth - 8,
          height: rowHeight - 6,
          ellipsis: true,
        });
      });

      startY += rowHeight;

      // Draw data rows
      options.rows.forEach((row) => {
        if (startY + rowHeight > doc.page.height - 40) {
          doc.addPage({ margin: 30, size: "A4", layout: "landscape" });
          startY = 30;

          // Header on new page
          doc.rect(startX, startY, pageWidth, rowHeight).fill("#EAEAEA");
          doc.fillColor("#000000").fontSize(9);
          options.headers.forEach((header, idx) => {
            doc.text(header, startX + idx * colWidth + 4, startY + 6, {
              width: colWidth - 8,
              height: rowHeight - 6,
              ellipsis: true,
            });
          });
          startY += rowHeight;
        }

        row.forEach((cell, idx) => {
          doc.fillColor("#000000").fontSize(8).text(String(cell ?? ""), startX + idx * colWidth + 4, startY + 6, {
            width: colWidth - 8,
            height: rowHeight - 6,
            ellipsis: true,
          });
        });

        doc
          .moveTo(startX, startY + rowHeight)
          .lineTo(startX + pageWidth, startY + rowHeight)
          .strokeColor("#E0E0E0")
          .lineWidth(0.5)
          .stroke();

        startY += rowHeight;
      });

      if (options.footerText) {
        doc.moveDown(1);
        doc.fontSize(8).fillColor("#666666").text(options.footerText, { align: "right" });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
