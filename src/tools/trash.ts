import { mkdir, rename, readFile, writeFile } from "node:fs/promises";
import { join, dirname, resolve, basename } from "node:path";
import { homedir } from "node:os";

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
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
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

export async function moveToTrash(filePath: string, rootBoundary: string): Promise<TrashEntry> {
  const resolvedPath = resolve(filePath);
  const resolvedBoundary = resolve(rootBoundary);

  if (!resolvedPath.startsWith(resolvedBoundary)) {
    return {
      isError: true,
      content: `Path ${filePath} is outside root boundary ${rootBoundary}`,
    } as any;
  }

  const trashDir = await ensureTrashDir();
  const id = generateId();
  const fileName = basename(filePath);
  const trashPath = join(trashDir, `${id}_${fileName}`);

  await rename(filePath, trashPath);

  const entry: TrashEntry = {
    id,
    originalPath: filePath,
    trashPath,
    timestamp: Date.now(),
    operation: "delete",
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

  await mkdir(dirname(entry.originalPath), { recursive: true });
  await rename(trashPath, entry.originalPath);

  const updatedEntries = entries.filter((e) => e.id !== entry.id);
  await writeUndoLog(updatedEntries);

  return entry.originalPath;
}
