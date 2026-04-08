import { buildCompanyWorkbookBuffer } from "@/lib/msp/export/excel";
import {
  completeExportJob,
  createExportJob,
  failExportJob,
  listCompanyRows,
} from "@/lib/msp/repository";
import { normalizeSearchFilters, searchRequestSchema } from "@/lib/msp/schemas";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  let exportJobId: string | null = null;

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = searchRequestSchema.parse(body);
    const filters = normalizeSearchFilters(parsed.filters ?? {});

    exportJobId = await createExportJob({
      userId: null,
      filters,
    });

    const rows = await listCompanyRows(filters);

    const buffer = await buildCompanyWorkbookBuffer(rows);
    const fileName = `msp-finder-export-${new Date().toISOString().slice(0, 10)}.xlsx`;

    await completeExportJob({
      exportJobId,
      rowCount: rows.length,
      fileName,
    });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename=\"${fileName}\"`,
      },
    });
  } catch (error) {
    if (exportJobId) {
      await failExportJob({
        exportJobId,
        errorMessage: error instanceof Error ? error.message : "Export failed",
      });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to export." },
      { status: 400 },
    );
  }
}
