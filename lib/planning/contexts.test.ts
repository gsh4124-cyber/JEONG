import assert from "node:assert/strict";
import test from "node:test";
import type { Project, TaskItem } from "./types";

const task = (id: string, contextId?: string): TaskItem => ({
  id, contextId, title: id, done: false, bucket: "today", scheduledAt: "", durationMinutes: 30, syncCalendar: false,
});
const project = (id: string, contextId?: string): Project => ({
  id, contextId, name: id, goal: "", next: "", status: "active", milestones: [], note: "",
});

test("Context filters preserve unassigned data in ALL and isolate assigned data", async () => {
  const { DEFAULT_CONTEXTS, filterTasksByContext, filterProjectsByContext } = await import("./contexts" + ".ts");
  const tasks = [task("legacy"), task("personal", "personal"), task("work", "work"), task("church", "church")];
  assert.deepEqual(filterTasksByContext(tasks, DEFAULT_CONTEXTS, "ALL").map((item: TaskItem) => item.id), ["legacy", "personal", "work", "church"]);
  assert.deepEqual(filterTasksByContext(tasks, DEFAULT_CONTEXTS, "PERSONAL").map((item: TaskItem) => item.id), ["personal"]);
  assert.deepEqual(filterTasksByContext(tasks, DEFAULT_CONTEXTS, "WORK").map((item: TaskItem) => item.id), ["work"]);
  assert.deepEqual(filterTasksByContext(tasks, DEFAULT_CONTEXTS, "CHURCH").map((item: TaskItem) => item.id), ["church"]);

  const projects = [project("legacy"), project("work", "work")];
  assert.deepEqual(filterProjectsByContext(projects, DEFAULT_CONTEXTS, "ALL").map((item: Project) => item.id), ["legacy", "work"]);
  assert.deepEqual(filterProjectsByContext(projects, DEFAULT_CONTEXTS, "WORK").map((item: Project) => item.id), ["work"]);
});

test("Calendar Context mapping combines with Context filtering and defaults", async () => {
  const { DEFAULT_CONTEXTS, filterCalendarEventsByContext, getDefaultCalendarId } = await import("./contexts" + ".ts");
  const mappings = [{ calendarId: "personal-cal", contextId: "personal" }, { calendarId: "work-cal", contextId: "work" }];
  const events = [{ id: "unassigned", calendarId: "other" }, { id: "personal", calendarId: "personal-cal" }, { id: "work", calendarId: "work-cal" }];
  assert.deepEqual(filterCalendarEventsByContext(events, mappings, DEFAULT_CONTEXTS, "ALL").map((item: {id:string}) => item.id), ["unassigned", "personal", "work"]);
  assert.deepEqual(filterCalendarEventsByContext(events, mappings, DEFAULT_CONTEXTS, "WORK").map((item: {id:string}) => item.id), ["work"]);
  assert.equal(getDefaultCalendarId([{ contextId: "work", defaultCalendarId: "preferred" }], mappings, "work", "primary"), "preferred");
  assert.equal(getDefaultCalendarId([], mappings, "personal", "primary"), "personal-cal");
  assert.equal(getDefaultCalendarId([], mappings, "church", "primary"), "primary");
});
