import { CompanyRow } from "@/lib/msp/types";
import ExcelJS from "exceljs";

const EXPORT_COLUMNS = [
  "Company Name",
  "Website",
  "Evidence",
  "Geography",
  "Employee Count",
  "Score (0-10)",
] as const;

export function getExportColumns(): readonly string[] {
  return EXPORT_COLUMNS;
}

export async function buildCompanyWorkbookBuffer(
  rows: CompanyRow[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("MSP Finder");

  worksheet.columns = [
    { header: EXPORT_COLUMNS[0], key: "companyName", width: 30 },
    { header: EXPORT_COLUMNS[1], key: "website", width: 36 },
    { header: EXPORT_COLUMNS[2], key: "evidence", width: 60 },
    { header: EXPORT_COLUMNS[3], key: "geography", width: 22 },
    { header: EXPORT_COLUMNS[4], key: "employeeCount", width: 18 },
    { header: EXPORT_COLUMNS[5], key: "score", width: 14 },
  ];

  worksheet.getRow(1).font = { bold: true };
  worksheet.views = [{ state: "frozen", ySplit: 1 }];

  for (const row of rows) {
    worksheet.addRow({
      companyName: row.companyName,
      website: row.website ?? "",
      evidence: row.evidence,
      geography: row.geography ?? "",
      employeeCount: row.employeeCount,
      score: row.score ?? "",
    });
  }

  worksheet.getColumn("evidence").alignment = {
    wrapText: true,
    vertical: "top",
  };

  for (let i = 2; i <= worksheet.rowCount; i += 1) {
    worksheet.getRow(i).alignment = { vertical: "top" };
  }

  const data = await workbook.xlsx.writeBuffer();
  return Buffer.from(data);
}
