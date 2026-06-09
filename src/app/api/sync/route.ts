import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { runSync } from "@/lib/sync";

// Sync runs server-side only, so provider tokens never reach the browser.
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = await runSync(store);
    return NextResponse.json(result, { status: result.ok ? 200 : 207 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
