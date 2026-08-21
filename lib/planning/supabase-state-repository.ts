import type { SupabaseUser as User } from "@/lib/supabase/client";
import type { LocalState } from "./types";
import { LOCAL_STATE_SCHEMA_VERSION } from "./local-state-repository";
import { createStateBackup } from "./state-backup";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type RemoteStateEnvelope = {
  schemaVersion: number;
  revision: number;
  state: LocalState;
  stateHash?: string | null;
  updatedAt: string;
};

export class RemoteRevisionConflictError extends Error {
  constructor() {
    super("JEONG_REVISION_CONFLICT");
    this.name = "RemoteRevisionConflictError";
  }
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function canonicalizeJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeJson);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.keys(record).sort().reduce<Record<string, unknown>>((result, key) => {
      result[key] = canonicalizeJson(record[key]);
      return result;
    }, {});
  }
  return value;
}

function rowToEnvelope(row: Record<string, unknown>): RemoteStateEnvelope {
  return {
    schemaVersion: Number(row.schema_version),
    revision: Number(row.revision),
    state: row.state as LocalState,
    stateHash: row.state_hash as string | null,
    updatedAt: String(row.updated_at),
  };
}

function assertRemoteStateShape(value: unknown): asserts value is LocalState {
  if (!value || typeof value !== "object") throw new Error("JEONG_REMOTE_INVALID_STATE");
  const state = value as Record<string, unknown>;
  const requiredArrays = [
    "tasks", "people", "projects", "activities", "notes", "chapters", "contexts",
    "calendarContextMappings", "contextCalendarPreferences", "calendarEventContextOverrides",
    "recurringTasks", "recurringTaskCompletions", "plans", "goals",
    "personalInsightPreferences", "operatingReminderPreferences",
  ];
  if (!requiredArrays.every(key => Array.isArray(state[key]))) throw new Error("JEONG_REMOTE_INVALID_STATE_STRUCTURE");
  if (!state.reviews || typeof state.reviews !== "object" || Array.isArray(state.reviews)) throw new Error("JEONG_REMOTE_INVALID_REVIEWS");
}

function isRevisionConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as Record<string, unknown>;
  return [record.message, record.details, record.hint, record.code]
    .filter(Boolean)
    .some(value => String(value).includes("JEONG_REVISION_CONFLICT"));
}

function requireClient() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("SUPABASE_NOT_CONFIGURED");
  return supabase;
}

async function requireAuthenticatedUser(expectedUserId?: string): Promise<User> {
  const supabase = requireClient();
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  const user = session?.user;
  if (!user) throw new Error("SUPABASE_NOT_AUTHENTICATED");
  if (expectedUserId && user.id !== expectedUserId) throw new Error("SUPABASE_USER_MISMATCH");
  return user;
}

export async function waitForSupabaseUser(expectedEmail?: string, timeoutMs = 15_000): Promise<User> {
  const supabase = requireClient();
  const normalizeEmail = (value?: string | null) => String(value ?? "").trim().toLowerCase();
  const expected = normalizeEmail(expectedEmail);
  const matches = (user?: User | null) => Boolean(user && (!expected || normalizeEmail(user.email) === expected));

  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (matches(session?.user)) return session!.user;

  return new Promise<User>((resolve, reject) => {
    let settled = false;
    let unsubscribe: () => void = () => {};
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      unsubscribe();
      callback();
    };
    const timer = window.setTimeout(() => {
      finish(() => reject(new Error(expected ? "SUPABASE_AUTH_TIMEOUT_OR_USER_MISMATCH" : "SUPABASE_AUTH_TIMEOUT")));
    }, timeoutMs);
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (matches(nextSession?.user)) finish(() => resolve(nextSession!.user));
    });
    unsubscribe = () => subscription.unsubscribe();
    if (settled) subscription.unsubscribe();
  });
}

export async function hashLocalState(state: LocalState): Promise<string> {
  const canonicalState = canonicalizeJson({ ...state, schemaVersion: LOCAL_STATE_SCHEMA_VERSION });
  return sha256(JSON.stringify(canonicalState));
}

export async function readRemoteState(expectedUserId?: string): Promise<RemoteStateEnvelope | null> {
  const supabase = requireClient();
  const user = await requireAuthenticatedUser(expectedUserId);
  const { data, error } = await supabase
    .from("jeong_state")
    .select("schema_version,revision,state,state_hash,updated_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const envelope = rowToEnvelope(data as Record<string, unknown>);
  assertRemoteStateShape(envelope.state);
  if (!Number.isInteger(envelope.revision) || envelope.revision < 1) throw new Error("JEONG_REMOTE_INVALID_REVISION");
  if (envelope.stateHash) {
    const actualHash = await hashLocalState(envelope.state);
    if (actualHash !== envelope.stateHash) throw new Error("JEONG_REMOTE_HASH_MISMATCH");
  }
  return envelope;
}

export async function saveRemoteState(
  state: LocalState,
  expectedRevision: number,
  expectedUserId?: string,
): Promise<RemoteStateEnvelope> {
  const supabase = requireClient();
  await requireAuthenticatedUser(expectedUserId);
  const normalizedState = { ...state, schemaVersion: LOCAL_STATE_SCHEMA_VERSION } as LocalState;
  const stateHash = await hashLocalState(normalizedState);
  const { data, error } = await supabase.rpc("save_jeong_state", {
    expected_revision: expectedRevision,
    new_schema_version: LOCAL_STATE_SCHEMA_VERSION,
    new_state: normalizedState,
    new_state_hash: stateHash,
  });
  if (error) {
    if (isRevisionConflict(error)) throw new RemoteRevisionConflictError();
    throw error;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("JEONG_REMOTE_SAVE_EMPTY_RESPONSE");
  return rowToEnvelope(row as Record<string, unknown>);
}

export async function createInitialRemoteState(localState: LocalState, expectedUserId?: string): Promise<RemoteStateEnvelope> {
  const supabase = requireClient();
  const user = await requireAuthenticatedUser(expectedUserId);
  if (await readRemoteState(user.id)) throw new Error("JEONG_REMOTE_ALREADY_EXISTS");
  const state = { ...localState, schemaVersion: LOCAL_STATE_SCHEMA_VERSION } as LocalState;
  const backup = createStateBackup(state);
  const { error: backupError } = await supabase.from("jeong_state_backups").insert({
    user_id: user.id,
    schema_version: backup.schemaVersion,
    revision: 0,
    reason: "initial_local_import",
    state: backup.state,
  });
  if (backupError) throw backupError;
  return saveRemoteState(state, 0, user.id);
}

export async function verifyRoundTrip(localState: LocalState, expectedUserId?: string) {
  const localHash = await hashLocalState(localState);
  const remote = await readRemoteState(expectedUserId);
  if (!remote) throw new Error("JEONG_REMOTE_MISSING");
  const remoteHash = await hashLocalState(remote.state);
  return { ok: localHash === remoteHash, localHash, remoteHash, revision: remote.revision };
}
