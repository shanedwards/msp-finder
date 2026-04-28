import { saveCompanyNotes } from "@/lib/msp/repository";
import { NextResponse } from "next/server";
import { z } from "zod";

const notesRequestSchema = z.object({
  notes: z.string().trim().max(2000).nullable(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = notesRequestSchema.parse(body);

    await saveCompanyNotes({
      companyId: id,
      notes: parsed.notes,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save notes." },
      { status: 400 },
    );
  }
}
