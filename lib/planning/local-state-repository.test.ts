import assert from "node:assert/strict";
import test from "node:test";
import type { Context, LocalState, NoteType } from "./types";

const DEFAULT_CONTEXTS: Context[] = [
  { id: "personal", key: "PERSONAL", name: "개인", sortOrder: 10, isActive: true },
  { id: "work", key: "WORK", name: "직장", sortOrder: 20, isActive: true },
  { id: "church", key: "CHURCH", name: "교회", sortOrder: 30, isActive: true },
];

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
}

test("legacy planning state remains compatible and round-trips with schemaVersion", async () => {
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  Object.defineProperty(globalThis, "window", { configurable: true, value: globalThis });
  storage.setItem("jeong_doneat_migrated_v934", "1");
  storage.setItem("jeong_daily_reset_migrated_v935", "1");
  const today = new Date().toLocaleDateString("sv-SE");
  storage.setItem("jeong_daily_content_date", today);
  storage.setItem("jeong_last_active_date", today);

  const repository = await import("./local-state-repository" + ".ts");
  const noteLabels: Record<NoteType, string> = {
    idea: "아이디어", thought: "생각", question: "질문", principle: "원칙", quote: "인용",
  };
  const fallback: LocalState = {
    schemaVersion: 1,
    morningDate: "",
    goal: "",
    reason: "",
    enjoyment: "",
    gratitude: ["", "", ""],
    tasks: [], people: [], projects: [], activities: [], notes: [], reviews: {}, chapters: [],
    contexts: DEFAULT_CONTEXTS, calendarContextMappings: [], contextCalendarPreferences: [], recurringTasks: [], recurringTaskCompletions: [], plans: [], goals: [],
  };
  const legacy = {
    morningDate: today,
    goal: "오늘 목표",
    reason: "목표 이유",
    enjoyment: "산책",
    gratitude: ["가족", "건강", "일"],
    tasks: [{ id: "t1", title: "기존 할 일", done: true, doneAt: today, bucket: "today", scheduledAt: "", durationMinutes: 30, syncCalendar: true, calendarEventId: "google-1", projectId: "p1" }],
    projects: [{ id: "p1", name: "기존 프로젝트", goal: "완료", next: "다음", status: "active", milestones: [{ id: "m1", title: "단계", done: true, weight: 100 }], note: "메모" }],
    activities: [], notes: [], people: [], chapters: [],
    recurringTasks: [
      { id:"phase3-test", title:"P3 매일 검증 (삭제 예정)", recurrence:{type:"DAILY"}, startDate:today, priority:"normal", showOnCalendar:false, isActive:false, createdAt:today, updatedAt:today },
      { id:"real", title:"실제 반복 업무", recurrence:{type:"DAILY"}, startDate:today, priority:"normal", showOnCalendar:false, isActive:true, createdAt:today, updatedAt:today },
    ],
    recurringTaskCompletions: [{recurringTaskId:"phase3-test",occurrenceDate:today,status:"skipped"}],
    reviews: { [today]: { date: today, goal: "오늘 목표", enjoyment: "산책", status: "done", reason: "완료", good: "집중", learned: "배움", joy: "산책", gratitude: "가족 / 건강 / 일", morningGratitude: ["가족", "건강", "일"], eveningGratitude: ["하루", "대화", "휴식"] } },
  };
  storage.setItem(repository.LOCAL_STATE_KEY, JSON.stringify(legacy));

  const loaded = repository.loadLocalState({ defaultState: fallback, noteLabels });
  assert.equal(loaded.schemaVersion, 3);
  assert.equal(loaded.tasks[0].calendarEventId, "google-1");
  assert.equal(loaded.tasks[0].projectId, "p1");
  assert.equal(loaded.tasks[0].done, true);
  assert.equal(loaded.tasks[0].contextId, undefined);
  assert.equal(loaded.projects[0].contextId, undefined);
  assert.deepEqual(loaded.gratitude, ["가족", "건강", "일"]);
  assert.deepEqual(loaded.reviews[today].eveningGratitude, ["하루", "대화", "휴식"]);
  assert.deepEqual(loaded.contexts.map((context: Context) => context.id), ["personal", "work", "church"]);
  assert.deepEqual(loaded.calendarContextMappings, []);
  assert.deepEqual(loaded.recurringTasks.map((item: LocalState["recurringTasks"][number])=>item.id), ["real"]);
  assert.deepEqual(loaded.recurringTaskCompletions, []);
  assert.deepEqual(loaded.plans, []);
  assert.deepEqual(loaded.goals, []);

  repository.saveLocalState(loaded);
  const saved = JSON.parse(storage.getItem(repository.LOCAL_STATE_KEY) ?? "{}");
  assert.equal(saved.schemaVersion, 3);
  assert.equal(saved.tasks[0].calendarEventId, "google-1");
  assert.equal(saved.tasks[0].projectId, "p1");
  assert.equal(saved.tasks[0].contextId, undefined);

  loaded.calendarContextMappings = [{ calendarId: "work-cal", contextId: "work" }];
  loaded.contextCalendarPreferences = [{ contextId: "work", defaultCalendarId: "work-cal" }];
  loaded.recurringTasks = [{
    id: "recurring-1",
    contextId: "work",
    projectId: "p1",
    title: "주간 계획 점검",
    description: "한 주의 우선순위를 확인합니다.",
    recurrence: { type: "WEEKLY", weekdays: [1, 3, 5], interval: 1 },
    startDate: today,
    timeOfDay: "09:30",
    durationMinutes: 30,
    priority: "high",
    showOnCalendar: true,
    calendarId: "work-cal",
    calendarEventId: "google-recurring-1",
    isActive: true,
    createdAt: "2026-08-10T00:00:00.000Z",
    updatedAt: "2026-08-10T00:00:00.000Z",
  }];
  loaded.recurringTaskCompletions = [{
    recurringTaskId: "recurring-1",
    occurrenceDate: today,
    status: "done",
    completedAt: "2026-08-10T09:35:00.000Z",
  }];
  repository.saveLocalState(loaded);

  const reloaded = repository.loadLocalState({ defaultState: fallback, noteLabels });
  assert.deepEqual(reloaded.tasks, loaded.tasks);
  assert.deepEqual(reloaded.projects, loaded.projects);
  assert.deepEqual(reloaded.reviews, loaded.reviews);
  assert.deepEqual(reloaded.calendarContextMappings, loaded.calendarContextMappings);
  assert.deepEqual(reloaded.contextCalendarPreferences, loaded.contextCalendarPreferences);
  assert.deepEqual(reloaded.recurringTasks, loaded.recurringTasks);
  assert.deepEqual(reloaded.recurringTaskCompletions, loaded.recurringTaskCompletions);
  assert.deepEqual(reloaded.plans, loaded.plans);
  assert.deepEqual(reloaded.goals, loaded.goals);
});
