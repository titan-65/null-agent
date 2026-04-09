import { mkdir, rename, readFile, writeFile } from "node:fs/promises";
import { join, dirname, resolve, basename } from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";

const TRASH_DIR_NAME = ".null-agent";
const TRASH_SUBDIR = "trash";
const UNDO_FILENAME = "undo.json";

function getTrashBase(): string {
  return process.env.NULL_AGENT_TEST_HOME || join(homedir(), TRASH_DIR_NAME);
}

function getTrashDir(): string {
  return join(getTrashBase(), TRASH_SUBDIR);
}

function getUndoFile(): string {
  return join(getTrashBase(), UNDO_FILENAME);
}

export interface TrashEntry {
  id: string;
  originalPath: string;
  trashPath: string;
  timestamp: number;
  operation: "move" | "delete";
  rootBoundary: string;
}

function generateId(): string {
  return randomUUID();
}

async function ensureTrashDir(): Promise<string> {
  const timestamp = Date.now();
  const trashPath = join(getTrashDir(), timestamp.toString());
  await mkdir(trashPath, { recursive: true });
  return trashPath;
}

async function readUndoLog(): Promise<TrashEntry[]> {
  try {
    const content = await readFile(getUndoFile(), "utf-8");
    return JSON.parse(content);
  } catch {
    return [];
  }
}

async function writeUndoLog(entries: TrashEntry[]): Promise<void> {
  await mkdir(dirname(getUndoFile()), { recursive: true });
  await writeFile(getUndoFile(), JSON.stringify(entries, null, 2), "utf-8");
}

export type MoveToTrashResult = TrashEntry | { isError: true; content: string };

export async function moveToTrash(
  filePath: string,
  rootBoundary: string,
): Promise<MoveToTrashResult> {
  const resolvedPath = resolve(filePath);
  const resolvedBoundary = resolve(rootBoundary);

  if (!resolvedPath.startsWith(resolvedBoundary)) {
    return {
      isError: true,
      content: `Path ${filePath} is outside root boundary ${rootBoundary}`,
    };
  }

  const trashDir = await ensureTrashDir();
  const id = generateId();
  const fileName = basename(filePath);
  const trashPath = join(trashDir, `${id}_${fileName}`);

  try {
    await rename(filePath, trashPath);
  } catch (err) {
    return {
      isError: true,
      content: `Failed to move file to trash: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const entry: TrashEntry = {
    id,
    originalPath: filePath,
    trashPath,
    timestamp: Date.now(),
    operation: "delete",
    rootBoundary: resolvedBoundary,
  };

  const entries = await readUndoLog();
  entries.push(entry);
  await writeUndoLog(entries);

  return entry;
}

export async function getTrashEntries(): Promise<TrashEntry[]> {
  return readUndoLog();
}

export async function restore(
  trashPath: string,
): Promise<string | { isError: true; content: string }> {
  const entries = await readUndoLog();
  const entry = entries.find((e) => e.trashPath === trashPath);

  if (!entry) {
    return {
      isError: true,
      content: `Trash entry not found: ${trashPath}`,
    };
  }

  const resolvedOriginalPath = resolve(entry.originalPath);
  if (!resolvedOriginalPath.startsWith(entry.rootBoundary)) {
    return {
      isError: true,
      content: `Cannot restore: original path ${entry.originalPath} is outside the root boundary ${entry.rootBoundary}`,
    };
  }

  try {
    await mkdir(dirname(entry.originalPath), { recursive: true });
  } catch (err) {
    return {
      isError: true,
      content: `Failed to create original directory: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  try {
    await rename(trashPath, entry.originalPath);
  } catch (err) {
    return {
      isError: true,
      content: `Failed to restore file: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const updatedEntries = entries.filter((e) => e.id !== entry.id);
  await writeUndoLog(updatedEntries);

  return entry.originalPath;
}
