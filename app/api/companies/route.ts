import { listCompanyRows } from "@/lib/msp/repository";
import { parseCompanyListFiltersFromSearchParams } from "@/lib/msp/schemas";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const filters = parseCompanyListFiltersFromSearchParams(url.searchParams);
    const rows = await listCompanyRows(filters);
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch companies." },
      { status: 400 },
    );
  }
}
