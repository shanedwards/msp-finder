import { searchRequestSchema } from "@/lib/msp/schemas";
import { runSearchWorkflow } from "@/lib/msp/workflow/graph";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

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
    const message =
      error instanceof ZodError
        ? (error.issues[0]?.message ?? "Invalid request.")
        : error instanceof Error
          ? error.message
          : "Search failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
