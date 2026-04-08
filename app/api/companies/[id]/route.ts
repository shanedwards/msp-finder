import { getCompanyDetail } from "@/lib/msp/repository";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const company = await getCompanyDetail(id);

    if (!company) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(company);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch company." },
      { status: 400 },
    );
  }
}
