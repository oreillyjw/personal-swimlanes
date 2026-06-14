import { promises as fs } from "node:fs";
import path from "node:path";
import { boardSchema, syncedSchema, type Board, type IssueOverride, type Synced } from "./types";

/**
 * All disk access goes through this interface. To move storage elsewhere later
 * (e.g. a hosted DB), add one implementation — the UI and providers never touch
 * the filesystem directly, so nothing else changes.
 */
export interface Store {
  getBoard(): Promise<Board>;
  getSynced(): Promise<Synced>;
  writeSynced(synced: Synced): Promise<void>;
  /** Local-only: merge hide/pin for one issue into board.json. */
  setIssueState(key: string, patch: Partial<IssueOverride>): Promise<Board>;
}

const DATA_DIR = path.join(process.cwd(), "data");
const BOARD_FILE = path.join(DATA_DIR, "board.json");
const BOARD_EXAMPLE_FILE = path.join(DATA_DIR, "board.example.json");
const SYNCED_FILE = path.join(DATA_DIR, "synced.json");

const EMPTY_SYNCED: Synced = { sources: {}, lastSyncAt: null };

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** Atomic write: temp file in the same dir, fsync, then rename over the target. */
async function atomicWriteJson(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  const handle = await fs.open(tmp, "w");
  try {
    await handle.writeFile(JSON.stringify(data, null, 2) + "\n", "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fs.rename(tmp, filePath);
}

export class JsonFileStore implements Store {
  async getBoard(): Promise<Board> {
    // Prefer the working board.json; fall back to the committed example so a
    // fresh clone renders before the user has copied it.
    const useExample = !(await fileExists(BOARD_FILE));
    const target = useExample ? BOARD_EXAMPLE_FILE : BOARD_FILE;
    let raw: string;
    try {
      raw = await fs.readFile(target, "utf8");
    } catch (err) {
      throw new Error(
        `Could not read board config at ${target}. ` +
          `Run: cp data/board.example.json data/board.json  (original: ${(err as Error).message})`
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new Error(`Invalid JSON in ${target}: ${(err as Error).message}`);
    }

    const result = boardSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(`Board config failed validation (${target}):\n${result.error.toString()}`);
    }
    return result.data;
  }

  async getSynced(): Promise<Synced> {
    if (!(await fileExists(SYNCED_FILE))) return structuredClone(EMPTY_SYNCED);
    const raw = await fs.readFile(SYNCED_FILE, "utf8");
    const result = syncedSchema.safeParse(JSON.parse(raw));
    if (!result.success) {
      // Synced cache is disposable — a corrupt cache should not break the board.
      console.warn(`synced.json failed validation; ignoring cache. ${result.error.toString()}`);
      return structuredClone(EMPTY_SYNCED);
    }
    return result.data;
  }

  async writeSynced(synced: Synced): Promise<void> {
    await atomicWriteJson(SYNCED_FILE, synced);
  }

  async setIssueState(key: string, patch: Partial<IssueOverride>): Promise<Board> {
    // Read the effective board (board.json, or the example on a fresh clone),
    // merge the override, and write to board.json — never back to the VCS.
    const board = await this.getBoard();
    const current = board.issueState[key] ?? { hidden: false, pinned: false };
    board.issueState[key] = { ...current, ...patch };
    await atomicWriteJson(BOARD_FILE, board);
    return board;
  }
}

/** Default singleton store used by route handlers / server components. */
export const store: Store = new JsonFileStore();
