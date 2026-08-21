"use client";

import { useEffect, useRef, useState } from "react";
import { Dashboard } from "@/components/dashboard";
import { DEFAULT_CONTEXTS } from "@/lib/planning/contexts";
import {
  LEGACY_LOCAL_STATE_KEYS,
  LOCAL_STATE_KEY,
  LOCAL_STATE_SCHEMA_VERSION,
  loadLocalState,
} from "@/lib/planning/local-state-repository";
import {
  RemoteRevisionConflictError,
  createInitialRemoteState,
  hashLocalState,
  readRemoteState,
  saveRemoteState,
  waitForSupabaseUser,
} from "@/lib/planning/supabase-state-repository";
import {
  clearPendingRemoteState,
  preserveConflictRemoteState,
  readPendingRemoteState,
  writePendingRemoteState,
} from "@/lib/planning/supabase-sync-recovery";
import type { LocalState, NoteType } from "@/lib/planning/types";

type DashboardUser = { name?: string | null; email?: string | null; image?: string | null };

type GateMode = "loading" | "ready" | "blocked";

const CUTOVER_BACKUP_KEY = "jeong_lifeos_before_supabase_cutover_v1";
const USER_MIRROR_PREFIX = "jeong_lifeos_supabase_mirror_v1:";
const ACTIVE_OWNER_KEY = "jeong_lifeos_active_owner_v1";
const LEGACY_OWNER_KEY = "jeong_lifeos_legacy_owner_v1";
const USER_DAILY_PREFIX = "jeong_daily_content_date_v1:";
const SHARED_DAILY_KEY = "jeong_daily_content_date";
const SHARED_LAST_ACTIVE_KEY = "jeong_last_active_date";

const noteLabels: Record<NoteType, string> = {
  idea: "아이디어",
  thought: "생각",
  question: "질문",
  principle: "기준",
  quote: "어록",
};

const defaultState: LocalState = {
  schemaVersion: LOCAL_STATE_SCHEMA_VERSION,
  morningDate: "",
  goal: "",
  reason: "",
  enjoyment: "",
  gratitude: ["", "", ""],
  tasks: [],
  people: [],
  projects: [],
  activities: [],
  notes: [],
  reviews: {},
  chapters: [],
  contexts: DEFAULT_CONTEXTS,
  calendarContextMappings: [],
  contextCalendarPreferences: [],
  calendarEventContextOverrides: [],
  recurringTasks: [],
  recurringTaskCompletions: [],
  plans: [],
  goals: [],
  personalInsightPreferences: [],
  operatingReminderPreferences: [],
};

function cloneState(state: LocalState): LocalState {
  return JSON.parse(JSON.stringify(state)) as LocalState;
}

function parseState(raw: string | null): LocalState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as LocalState;
  } catch {
    return null;
  }
}

function serializeState(state: LocalState): string {
  return JSON.stringify({ ...state, schemaVersion: LOCAL_STATE_SCHEMA_VERSION });
}

function preserveCutoverBackup(): void {
  if (localStorage.getItem(CUTOVER_BACKUP_KEY)) return;
  for (const key of [LOCAL_STATE_KEY, ...LEGACY_LOCAL_STATE_KEYS]) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    localStorage.setItem(CUTOVER_BACKUP_KEY, JSON.stringify({
      sourceKey: key,
      capturedAt: new Date().toISOString(),
      raw,
    }));
    return;
  }
}

function userMirrorKey(userId: string) {
  return `${USER_MIRROR_PREFIX}${userId}`;
}

function userDailyKey(userId: string) {
  return `${USER_DAILY_PREFIX}${userId}`;
}

function readUserMirror(userId: string): LocalState | null {
  return parseState(localStorage.getItem(userMirrorKey(userId)));
}

function writeUserMirror(userId: string, state: LocalState): void {
  localStorage.setItem(userMirrorKey(userId), serializeState(state));
}

function restoreUserDailyMetadata(userId: string): void {
  const stored = localStorage.getItem(userDailyKey(userId));
  if (stored) {
    localStorage.setItem(SHARED_DAILY_KEY, stored);
    localStorage.setItem(SHARED_LAST_ACTIVE_KEY, stored);
  } else {
    localStorage.removeItem(SHARED_DAILY_KEY);
    localStorage.removeItem(SHARED_LAST_ACTIVE_KEY);
  }
}

function captureUserDailyMetadata(userId: string): void {
  const value = localStorage.getItem(SHARED_DAILY_KEY) || localStorage.getItem(SHARED_LAST_ACTIVE_KEY);
  if (value) localStorage.setItem(userDailyKey(userId), value);
}

function activateSharedState(userId: string, state: LocalState): string {
  const raw = serializeState(state);
  localStorage.setItem(LOCAL_STATE_KEY, raw);
  localStorage.setItem(ACTIVE_OWNER_KEY, userId);
  writeUserMirror(userId, state);
  restoreUserDailyMetadata(userId);
  return raw;
}

function hasLegacyState(): boolean {
  return Boolean(localStorage.getItem(LOCAL_STATE_KEY) || LEGACY_LOCAL_STATE_KEYS.some((key) => localStorage.getItem(key)));
}

export function SupabaseStateGate({ user }: { user: DashboardUser }) {
  const [mode, setMode] = useState<GateMode>("loading");
  const [instanceKey, setInstanceKey] = useState(0);
  const [message, setMessage] = useState("사용자별 Supabase 데이터를 확인하고 있습니다.");

  const userIdRef = useRef<string | null>(null);
  const revisionRef = useRef<number | null>(null);
  const syncedHashRef = useRef<string | null>(null);
  const observedRawRef = useRef<string | null>(null);
  const pausedRef = useRef(true);
  const saveInFlightRef = useRef(false);
  const queuedStateRef = useRef<LocalState | null>(null);
  const mountedRef = useRef(true);

  const replaceWithRemote = async (state: LocalState, revision: number, stateHash?: string | null) => {
    const userId = userIdRef.current;
    if (!userId) return;
    const raw = activateSharedState(userId, state);
    observedRawRef.current = raw;
    revisionRef.current = revision;
    syncedHashRef.current = stateHash || await hashLocalState(state);
    pausedRef.current = false;
    if (mountedRef.current) setInstanceKey((value) => value + 1);
  };

  const preserveConflictAndReload = async (state: LocalState, baseRevision: number | null, reason: string) => {
    const userId = userIdRef.current;
    if (!userId) return;
    preserveConflictRemoteState({
      userId,
      baseRevision,
      capturedAt: new Date().toISOString(),
      state: cloneState(state),
      remoteRevision: null,
      reason,
    });
    writePendingRemoteState({ userId, baseRevision, capturedAt: new Date().toISOString(), state: cloneState(state) });
    pausedRef.current = true;
    const latest = await readRemoteState(userId);
    if (!latest) return;
    clearPendingRemoteState(userId);
    await replaceWithRemote(latest.state, latest.revision, latest.stateHash);
    setMessage(`동기화 충돌 감지 · 서버 revision ${latest.revision} 유지 · 이 기기 변경은 충돌 백업에 보존했습니다.`);
  };

  const persistState = async (state: LocalState): Promise<void> => {
    const userId = userIdRef.current;
    const revision = revisionRef.current;
    if (!userId || revision === null || pausedRef.current) {
      if (userId) writePendingRemoteState({ userId, baseRevision: revision, capturedAt: new Date().toISOString(), state: cloneState(state) });
      return;
    }
    if (saveInFlightRef.current) {
      queuedStateRef.current = cloneState(state);
      return;
    }

    saveInFlightRef.current = true;
    try {
      const saved = await saveRemoteState(state, revision, userId);
      revisionRef.current = saved.revision;
      syncedHashRef.current = saved.stateHash || await hashLocalState(saved.state);
      clearPendingRemoteState(userId);
      setMessage(`Supabase 동기화 완료 · revision ${saved.revision}`);
    } catch (error) {
      if (error instanceof RemoteRevisionConflictError) {
        await preserveConflictAndReload(state, revision, "revision_conflict");
      } else {
        writePendingRemoteState({ userId, baseRevision: revision, capturedAt: new Date().toISOString(), state: cloneState(state) });
        pausedRef.current = true;
        setMessage("원격 저장이 일시 중단되었습니다. 변경사항은 이 기기에 안전하게 보관합니다.");
      }
    } finally {
      saveInFlightRef.current = false;
      const queued = queuedStateRef.current;
      queuedStateRef.current = null;
      if (queued) {
        if (pausedRef.current) {
          const currentUser = userIdRef.current;
          if (currentUser) writePendingRemoteState({ userId: currentUser, baseRevision: revisionRef.current, capturedAt: new Date().toISOString(), state: queued });
        } else {
          void persistState(queued);
        }
      }
    }
  };

  const inspectLocalState = async () => {
    const userId = userIdRef.current;
    if (!userId || mode !== "ready") return;
    const raw = localStorage.getItem(LOCAL_STATE_KEY);
    if (!raw || raw === observedRawRef.current) {
      captureUserDailyMetadata(userId);
      return;
    }
    const state = parseState(raw);
    if (!state) return;
    observedRawRef.current = raw;
    writeUserMirror(userId, state);
    captureUserDailyMetadata(userId);
    const hash = await hashLocalState(state);
    if (hash === syncedHashRef.current) return;
    if (pausedRef.current) {
      writePendingRemoteState({ userId, baseRevision: revisionRef.current, capturedAt: new Date().toISOString(), state: cloneState(state) });
      return;
    }
    await persistState(state);
  };

  const recoverOrRefresh = async () => {
    const userId = userIdRef.current;
    if (!userId || mode !== "ready" || saveInFlightRef.current) return;
    const localState = parseState(localStorage.getItem(LOCAL_STATE_KEY));
    if (!localState) return;
    try {
      const latest = await readRemoteState(userId);
      if (!latest) return;
      const pending = readPendingRemoteState(userId);
      if (pending) {
        if (pending.baseRevision !== null && pending.baseRevision === latest.revision) {
          revisionRef.current = latest.revision;
          syncedHashRef.current = latest.stateHash || await hashLocalState(latest.state);
          pausedRef.current = false;
          await persistState(pending.state);
          return;
        }
        await preserveConflictAndReload(pending.state, pending.baseRevision, "revision_changed_while_offline");
        return;
      }

      const localHash = await hashLocalState(localState);
      if (localHash !== syncedHashRef.current) {
        pausedRef.current = false;
        await persistState(localState);
        return;
      }
      if (latest.revision !== revisionRef.current) {
        await replaceWithRemote(latest.state, latest.revision, latest.stateHash);
        setMessage(`다른 기기 변경 반영 완료 · revision ${latest.revision}`);
      } else {
        pausedRef.current = false;
      }
    } catch {
      pausedRef.current = true;
      writePendingRemoteState({ userId, baseRevision: revisionRef.current, capturedAt: new Date().toISOString(), state: cloneState(localState) });
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    void (async () => {
      try {
        const authUser = await waitForSupabaseUser(user.email ?? undefined);
        if (cancelled) return;
        userIdRef.current = authUser.id;
        preserveCutoverBackup();

        const userMirror = readUserMirror(authUser.id);
        const activeOwner = localStorage.getItem(ACTIVE_OWNER_KEY);
        const legacyOwner = localStorage.getItem(LEGACY_OWNER_KEY);
        let remote = await readRemoteState(authUser.id);
        let pending = readPendingRemoteState(authUser.id);
        let status = "";

        if (pending) {
          if (!remote) {
            remote = await createInitialRemoteState(pending.state, authUser.id);
            clearPendingRemoteState(authUser.id);
            pending = null;
            status = `저장 대기 데이터로 Supabase 원본 복구 완료 · revision ${remote.revision}`;
          } else if (pending.baseRevision !== null && pending.baseRevision === remote.revision) {
            const pendingAtSave = pending;
            try {
              remote = await saveRemoteState(pendingAtSave.state, remote.revision, authUser.id);
              clearPendingRemoteState(authUser.id);
              pending = null;
              status = `저장 대기 데이터 반영 완료 · revision ${remote.revision}`;
            } catch (error) {
              if (!(error instanceof RemoteRevisionConflictError)) throw error;
              const latest = await readRemoteState(authUser.id);
              if (!latest) throw new Error("JEONG_REMOTE_MISSING_AFTER_CONFLICT");
              preserveConflictRemoteState({
                userId: authUser.id,
                baseRevision: pendingAtSave.baseRevision,
                capturedAt: new Date().toISOString(),
                state: pendingAtSave.state,
                remoteRevision: latest.revision,
                reason: "startup_revision_conflict",
              });
              clearPendingRemoteState(authUser.id);
              pending = null;
              remote = latest;
              status = `시작 시 동기화 충돌 감지 · 서버 revision ${latest.revision} 유지`;
            }
          } else if (remote) {
            preserveConflictRemoteState({
              userId: authUser.id,
              baseRevision: pending.baseRevision,
              capturedAt: new Date().toISOString(),
              state: pending.state,
              remoteRevision: remote.revision,
              reason: pending.baseRevision === null ? "startup_unbased_local_changes" : "startup_revision_changed",
            });
            clearPendingRemoteState(authUser.id);
            pending = null;
            status = `시작 시 동기화 충돌 감지 · 서버 revision ${remote.revision} 유지`;
          }
        }

        if (!remote) {
          let candidate: LocalState;
          if (userMirror) {
            candidate = userMirror;
          } else if ((!activeOwner || activeOwner === authUser.id) && (!legacyOwner || legacyOwner === authUser.id) && hasLegacyState()) {
            candidate = loadLocalState({ defaultState, noteLabels });
            if (!legacyOwner) localStorage.setItem(LEGACY_OWNER_KEY, authUser.id);
          } else {
            candidate = cloneState(defaultState);
          }
          remote = await createInitialRemoteState(candidate, authUser.id);
          status = `Supabase 원본 생성 완료 · revision ${remote.revision}`;
        }

        if (cancelled) return;
        const raw = activateSharedState(authUser.id, remote.state);
        observedRawRef.current = raw;
        revisionRef.current = remote.revision;
        syncedHashRef.current = remote.stateHash || await hashLocalState(remote.state);
        pausedRef.current = false;
        setMessage(status || `Supabase 원본 로드 완료 · revision ${remote.revision}`);
        setMode("ready");
      } catch (error) {
        if (cancelled) return;
        pausedRef.current = true;
        const userId = userIdRef.current;
        const mirror = userId ? readUserMirror(userId) : null;
        if (userId && mirror) {
          const raw = activateSharedState(userId, mirror);
          observedRawRef.current = raw;
          revisionRef.current = readPendingRemoteState(userId)?.baseRevision ?? null;
          syncedHashRef.current = await hashLocalState(mirror);
          setMessage("Supabase 연결 실패 · 사용자별 로컬 안전 미러로 열었습니다. 원격 저장은 재연결 전까지 보류합니다.");
          setMode("ready");
        } else {
          setMessage("사용자 데이터를 안전하게 확인하지 못했습니다. 다른 사용자의 로컬 데이터를 대신 열지 않습니다.");
          setMode("blocked");
        }
      }
    })();

    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, [user.email]);

  useEffect(() => {
    if (mode !== "ready") return;
    const timer = window.setInterval(() => void inspectLocalState(), 700);
    const resume = () => void recoverOrRefresh();
    window.addEventListener("online", resume);
    window.addEventListener("focus", resume);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", resume);
      window.removeEventListener("focus", resume);
    };
  }, [mode]);

  if (mode === "loading") {
    return <main className="jeongLoadingPage" aria-live="polite" aria-busy="true"><div className="jeongLoadingSeal" aria-hidden="true">整</div><strong>JEONG을 정리하고 있습니다.</strong><span>{message}</span></main>;
  }

  if (mode === "blocked") {
    return <main className="jeongLoadingPage" aria-live="polite"><div className="jeongLoadingSeal" aria-hidden="true">整</div><strong>사용자 데이터를 안전하게 확인하지 못했습니다.</strong><span>{message}</span></main>;
  }

  return <Dashboard key={instanceKey} user={user} />;
}
