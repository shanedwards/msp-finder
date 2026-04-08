import { getCompanyDetail, saveCompanyScore } from "@/lib/msp/repository";
import { scoreCompanyRequestSchema } from "@/lib/msp/schemas";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = scoreCompanyRequestSchema.parse(body);

    await saveCompanyScore({
      companyId: id,
      userId: null,
      score: parsed.score,
      note: parsed.note ?? null,
    });

    const company = await getCompanyDetail(id);
    return NextResponse.json(company);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save score." },
      { status: 400 },
    );
  }
}
