import { NextResponse } from "next/server";
import { z } from "zod";
import { store } from "@/lib/store";

// Local-only: persists hide/pin into board.json. Never contacts the VCS.
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  key: z.string().min(1),
  hidden: z.boolean().optional(),
  pinned: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
    }
    const { key, ...patch } = parsed.data;
    await store.setIssueState(key, patch);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
