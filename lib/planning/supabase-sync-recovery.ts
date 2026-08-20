import type { LocalState } from "./types";

const pendingKey = (userId: string) => `jeong_supabase_pending_v1:${userId}`;
const conflictKey = (userId: string) => `jeong_supabase_conflict_backup_v1:${userId}`;

export type PendingRemoteState = {
  userId: string;
  baseRevision: number | null;
  capturedAt: string;
  state: LocalState;
};

export type ConflictRemoteStateBackup = PendingRemoteState & {
  remoteRevision: number | null;
  reason: string;
};

export function writePendingRemoteState(value: PendingRemoteState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(pendingKey(value.userId), JSON.stringify(value));
}

export function readPendingRemoteState(userId: string): PendingRemoteState | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(pendingKey(userId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingRemoteState;
    return parsed?.userId === userId && parsed.state ? parsed : null;
  } catch {
    return null;
  }
}

export function clearPendingRemoteState(userId: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(pendingKey(userId));
}

export function preserveConflictRemoteState(value: ConflictRemoteStateBackup): void {
  if (typeof window === "undefined") return;
  const key = conflictKey(value.userId);
  const raw = localStorage.getItem(key);
  let history: ConflictRemoteStateBackup[] = [];
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) history = parsed as ConflictRemoteStateBackup[];
    } catch {
      history = [];
    }
  }
  history.push(value);
  localStorage.setItem(key, JSON.stringify(history.slice(-10)));
}
