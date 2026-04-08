import { searchRequestSchema } from "@/lib/msp/schemas";
import { runSearchWorkflow } from "@/lib/msp/workflow/graph";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = searchRequestSchema.parse(body);

    const result = await runSearchWorkflow({
      userId: null,
      filters: parsed.filters ?? {},
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Search failed.",
      },
      { status: 400 },
    );
  }
}
