import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { boardSchema } from "@/lib/types";

// Local-only board config read/write (structure edits). Never contacts the VCS.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await store.getBoard());
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const parsed = boardSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: parsed.error.toString() }, { status: 400 });
    }
    await store.writeBoard(parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
