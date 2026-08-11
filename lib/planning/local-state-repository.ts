import type { LocalState, NoteType, Review } from "./types";

export const LOCAL_STATE_SCHEMA_VERSION = 3;
export const LOCAL_STATE_KEY = "jeong_lifeos_v5";
export const LEGACY_LOCAL_STATE_KEYS = [
  "jeong_integrated_google_v33",
  "jeong_integrated_google_v32",
  "jeong_integrated_google_v31",
] as const;

const DAILY_CONTENT_DATE_KEY = "jeong_daily_content_date";
const DAILY_RESET_MIGRATION_KEY = "jeong_daily_reset_migrated_v935";
const DONE_AT_MIGRATION_KEY = "jeong_doneat_migrated_v934";
const PHASE3_VALIDATION_CLEANUP_KEY = "jeong_phase3_validation_cleanup_v1";
const PHASE3_VALIDATION_TITLES = new Set(["P3 매일 검증 (삭제 예정)", "P3 Calendar 검증 수정 (삭제 예정)"]);

type UnknownState = Partial<LocalState> & Record<string, unknown>;
type NormalizeOptions = {
  defaultState: LocalState;
  noteLabels: Record<NoteType, string>;
};

const todayKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const addDays = (value: string, days: number) => {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return todayKey(date);
};
const uid = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
const gratitudeArray = (value: unknown) => {
  if (Array.isArray(value)) return [0, 1, 2].map((index) => String(value[index] ?? ""));
  if (typeof value === "string" && value.trim()) {
    return value.split(/\s*\/\s*|\n+/).slice(0, 3).concat(["", "", ""]).slice(0, 3);
  }
  return ["", "", ""];
};

function emptyReview(date: string, state: LocalState): Review {
  return {
    date,
    goal: date === todayKey() ? state.goal : "",
    enjoyment: date === todayKey() ? state.enjoyment : "",
    status: "",
    reason: "",
    good: "",
    learned: "",
    joy: "",
    gratitude: "",
    morningGratitude: date === todayKey() ? gratitudeArray(state.gratitude) : ["", "", ""],
    eveningGratitude: ["", "", ""],
  };
}

export function getSchemaVersion(value: unknown): number {
  if (!value || typeof value !== "object") return 0;
  const version = Number((value as { schemaVersion?: unknown }).schemaVersion);
  return Number.isInteger(version) && version >= 0 ? version : 0;
}

export function normalizeLocalState(value: unknown, options: NormalizeOptions): LocalState {
  const source = value && typeof value === "object" ? value as UnknownState : {};
  const defaults = options.defaultState;
  const legacyContacts = Array.isArray(source.contacts) ? source.contacts : [];
  const rawPeople = Array.isArray(source.people) ? source.people : legacyContacts;
  const people = rawPeople.map((raw) => {
    const person = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    return {
      id: String(person.id ?? uid()),
      name: String(person.name ?? ""),
      tags: Array.isArray(person.tags) ? person.tags.map(String) : ["보험"],
      lastContact: String(person.lastContact ?? ""),
      nextContact: String(person.nextContact ?? person.date ?? ""),
      note: String(person.note ?? person.purpose ?? ""),
      phone: String(person.phone ?? ""),
      email: String(person.email ?? ""),
      organization: String(person.organization ?? ""),
      source: String(person.source ?? ""),
      waiting: Boolean(person.waiting),
      logs: Array.isArray(person.logs) ? person.logs as LocalState["people"][number]["logs"] : [],
    };
  });

  const projects = (Array.isArray(source.projects) && source.projects.length ? source.projects : defaults.projects).map((raw) => {
    const project = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    return {
      id: String(project.id ?? uid()),
      name: String(project.name ?? "프로젝트"),
      goal: String(project.goal ?? ""),
      next: String(project.next ?? ""),
      status: (["planning", "active", "review", "done"].includes(String(project.status)) ? project.status : "active") as LocalState["projects"][number]["status"],
      milestones: Array.isArray(project.milestones) ? project.milestones as LocalState["projects"][number]["milestones"] : [],
      note: String(project.note ?? ""),
      ...(typeof project.contextId === "string" ? { contextId: project.contextId } : {}),
    };
  });

  const legacyMemory = source.memory && typeof source.memory === "object" ? source.memory as Record<string, unknown> : {};
  const notes = Array.isArray(source.notes)
    ? source.notes
    : Object.entries(legacyMemory).filter(([, body]) => body).map(([type, body]) => {
      const noteType: NoteType = type === "principle" ? "principle" : "thought";
      return { id: uid(), date: todayKey(), type: noteType, title: options.noteLabels[noteType], body: String(body), tags: [] };
    });

  let tasks = (Array.isArray(source.tasks) ? source.tasks : []).map((raw) => {
    const task = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    return { ...task, doneAt: task.doneAt ? String(task.doneAt) : undefined } as LocalState["tasks"][number];
  });
  const today = todayKey();
  const storedContentDate = localStorage.getItem(DAILY_CONTENT_DATE_KEY);
  const lastActive = storedContentDate || localStorage.getItem("jeong_last_active_date") || String(source.morningDate ?? "") || today;

  if (!localStorage.getItem(DONE_AT_MIGRATION_KEY)) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const fallback = todayKey(yesterday);
    tasks = tasks.map((task) => task.done && task.bucket === "today" && !task.doneAt ? { ...task, doneAt: fallback } : task);
    localStorage.setItem(DONE_AT_MIGRATION_KEY, "1");
  }

  let reviews = { ...(source.reviews && typeof source.reviews === "object" ? source.reviews as Record<string, Review> : {}) };
  let goal = String(source.goal ?? "");
  let reason = String(source.reason ?? "");
  let enjoyment = String(source.enjoyment ?? "");
  let gratitude = gratitudeArray(source.gratitude);
  let morningDate = String(source.morningDate ?? "");
  let dailyGoalId = typeof source.dailyGoalId === "string" ? source.dailyGoalId : undefined;
  let parentWeeklyGoalId = typeof source.parentWeeklyGoalId === "string" ? source.parentWeeklyGoalId : undefined;
  const archiveAndClear = (archiveDate: string) => {
    if (goal || reason || enjoyment || gratitude.some(Boolean)) {
      reviews[archiveDate] = {
        ...(reviews[archiveDate] ?? emptyReview(archiveDate, { ...defaults, goal, reason, enjoyment, gratitude })),
        date: archiveDate,
        goal,
        enjoyment,
        reason,
        gratitude: gratitude.filter(Boolean).join(" / "),
        morningGratitude: gratitudeArray(gratitude),
        eveningGratitude: gratitudeArray(reviews[archiveDate]?.eveningGratitude),
      };
    }
    tasks = tasks.map((task) => task.done && !task.doneAt ? { ...task, doneAt: archiveDate } : task);
    goal = "";
    reason = "";
    enjoyment = "";
    gratitude = ["", "", ""];
    morningDate = "";
    dailyGoalId = undefined;
    parentWeeklyGoalId = undefined;
  };

  if (!localStorage.getItem(DAILY_RESET_MIGRATION_KEY)) {
    const archiveDate = source.morningDate && source.morningDate !== today ? String(source.morningDate) : addDays(today, -1);
    if (goal || reason || enjoyment || gratitude.some(Boolean)) archiveAndClear(archiveDate);
    localStorage.setItem(DAILY_RESET_MIGRATION_KEY, "1");
  } else if (lastActive !== today) {
    archiveAndClear(lastActive);
  }
  localStorage.setItem(DAILY_CONTENT_DATE_KEY, today);
  localStorage.setItem("jeong_last_active_date", today);

  let recurringTasks = Array.isArray(source.recurringTasks) ? source.recurringTasks as LocalState["recurringTasks"] : [];
  let recurringTaskCompletions = Array.isArray(source.recurringTaskCompletions) ? source.recurringTaskCompletions as LocalState["recurringTaskCompletions"] : [];
  if (!localStorage.getItem(PHASE3_VALIDATION_CLEANUP_KEY)) {
    const validationIds = new Set(recurringTasks.filter(task => PHASE3_VALIDATION_TITLES.has(task.title)).map(task => task.id));
    recurringTasks = recurringTasks.filter(task => !validationIds.has(task.id));
    recurringTaskCompletions = recurringTaskCompletions.filter(completion => !validationIds.has(completion.recurringTaskId));
    localStorage.setItem(PHASE3_VALIDATION_CLEANUP_KEY, "1");
  }
  const plans = (Array.isArray(source.plans) ? source.plans : []).filter(item=>item&&typeof item==="object").map(item=>item as LocalState["plans"][number]);
  const goals = (Array.isArray(source.goals) ? source.goals : []).filter(item=>item&&typeof item==="object").map(item=>item as LocalState["goals"][number]);
  return {
    ...defaults,
    ...source,
    schemaVersion: LOCAL_STATE_SCHEMA_VERSION,
    morningDate,
    dailyGoalId,
    parentWeeklyGoalId,
    goal,
    reason,
    enjoyment,
    gratitude,
    tasks,
    people,
    projects,
    activities: Array.isArray(source.activities) ? source.activities as LocalState["activities"] : [],
    notes: notes as LocalState["notes"],
    reviews,
    chapters: Array.isArray(source.chapters) ? source.chapters as LocalState["chapters"] : defaults.chapters,
    contexts: Array.isArray(source.contexts) && source.contexts.length
      ? source.contexts as LocalState["contexts"]
      : defaults.contexts,
    calendarContextMappings: Array.isArray(source.calendarContextMappings)
      ? source.calendarContextMappings as LocalState["calendarContextMappings"]
      : [],
    contextCalendarPreferences: Array.isArray(source.contextCalendarPreferences)
      ? source.contextCalendarPreferences as LocalState["contextCalendarPreferences"]
      : [],
    recurringTasks,
    recurringTaskCompletions,
    plans,
    goals,
  };
}

export function loadLocalState(options: NormalizeOptions): LocalState {
  if (typeof window === "undefined") return options.defaultState;
  const raw = localStorage.getItem(LOCAL_STATE_KEY)
    ?? LEGACY_LOCAL_STATE_KEYS.map((key) => localStorage.getItem(key)).find(Boolean)
    ?? null;
  if (!raw) return normalizeLocalState(options.defaultState, options);
  try {
    return normalizeLocalState(JSON.parse(raw), options);
  } catch {
    return normalizeLocalState(options.defaultState, options);
  }
}

export function saveLocalState(state: LocalState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify({ ...state, schemaVersion: LOCAL_STATE_SCHEMA_VERSION }));
}
