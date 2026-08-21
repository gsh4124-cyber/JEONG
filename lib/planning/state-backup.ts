import type { LocalState } from "./types";
import { LOCAL_STATE_KEY, LOCAL_STATE_SCHEMA_VERSION } from "./local-state-repository";

export type JeongStateBackup = {
  format: "JEONG_STATE_BACKUP";
  schemaVersion: number;
  exportedAt: string;
  sourceKey: string;
  state: LocalState;
};

export function createStateBackup(state: LocalState): JeongStateBackup {
  return {
    format: "JEONG_STATE_BACKUP",
    schemaVersion: LOCAL_STATE_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    sourceKey: LOCAL_STATE_KEY,
    state,
  };
}

export function serializeStateBackup(state: LocalState): string {
  return JSON.stringify(createStateBackup(state), null, 2);
}
