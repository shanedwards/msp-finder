import { getCompanyDetail, saveCompanyReview } from "@/lib/msp/repository";
import { verifyCompanyRequestSchema } from "@/lib/msp/schemas";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = verifyCompanyRequestSchema.parse(body);

    await saveCompanyReview({
      companyId: id,
      userId: null,
      decision: parsed.decision,
      notes: parsed.notes ?? null,
    });

    const company = await getCompanyDetail(id);
    return NextResponse.json(company);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update review." },
      { status: 400 },
    );
  }
}
