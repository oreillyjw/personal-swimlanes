import { store } from "@/lib/store";
import { buildViewModel } from "@/lib/viewModel";
import { isSimulated } from "@/lib/providers";
import BoardClient from "@/components/BoardClient";

// Always read fresh JSON from disk on each request (local single-user tool).
export const dynamic = "force-dynamic";

export default async function Page() {
  const [board, synced] = await Promise.all([store.getBoard(), store.getSynced()]);
  const vm = buildViewModel(board, synced);

  return <BoardClient board={vm} simulated={isSimulated()} />;
}
