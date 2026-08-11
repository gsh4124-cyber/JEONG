import assert from "node:assert/strict";
import test from "node:test";
import type { RecurringTaskDefinition } from "./types";

const { getOccurrenceStatus, getOccurrencesForRange, occursOnDate } = await import("./recurrence" + ".ts");

const base = (recurrence: RecurringTaskDefinition["recurrence"], patch: Partial<RecurringTaskDefinition> = {}): RecurringTaskDefinition => ({
  id: "task", title: "반복 업무", recurrence, startDate: "2026-08-10", priority: "normal",
  showOnCalendar: false, isActive: true, createdAt: "2026-08-10T00:00:00.000Z", updatedAt: "2026-08-10T00:00:00.000Z", ...patch,
});

test("DAILY respects local date boundaries, startDate, endDate and active state", () => {
  const task = base({ type: "DAILY" }, { endDate: "2026-08-12" });
  assert.equal(occursOnDate(task, "2026-08-09"), false);
  assert.equal(occursOnDate(task, "2026-08-10"), true);
  assert.equal(occursOnDate(task, "2026-08-12"), true);
  assert.equal(occursOnDate(task, "2026-08-13"), false);
  assert.equal(occursOnDate({ ...task, isActive: false }, "2026-08-10"), false);
});

test("WEEKDAYS appears Monday through Friday only", () => {
  const task = base({ type: "WEEKDAYS" });
  assert.equal(occursOnDate(task, "2026-08-14"), true);
  assert.equal(occursOnDate(task, "2026-08-15"), false);
  assert.equal(occursOnDate(task, "2026-08-16"), false);
});

test("WEEKLY supports selected weekdays", () => {
  const task = base({ type: "WEEKLY", weekdays: [1, 3, 5], interval: 1 });
  assert.equal(occursOnDate(task, "2026-08-10"), true);
  assert.equal(occursOnDate(task, "2026-08-11"), false);
  assert.equal(occursOnDate(task, "2026-08-12"), true);
});

test("BIWEEKLY uses the start week as its anchor", () => {
  const task = base({ type: "WEEKLY", weekdays: [1], interval: 2 });
  assert.equal(occursOnDate(task, "2026-08-10"), true);
  assert.equal(occursOnDate(task, "2026-08-17"), false);
  assert.equal(occursOnDate(task, "2026-08-24"), true);
});

test("MONTHLY appears only on the configured day", () => {
  const task = base({ type: "MONTHLY", dayOfMonth: 1 }, { startDate: "2026-08-01" });
  assert.equal(occursOnDate(task, "2026-09-01"), true);
  assert.equal(occursOnDate(task, "2026-09-02"), false);
});

test("range calculation creates occurrences without storing rows", () => {
  const task = base({ type: "DAILY" });
  assert.equal(getOccurrencesForRange([task], "2026-08-10", "2026-08-12").length, 3);
});

test("completion lookup distinguishes done and skipped by occurrence date", () => {
  const task = base({ type: "DAILY" });
  const completions = [
    { recurringTaskId: "task", occurrenceDate: "2026-08-10", status: "done" as const, completedAt: "2026-08-10T09:00:00.000Z" },
    { recurringTaskId: "task", occurrenceDate: "2026-08-11", status: "skipped" as const },
  ];
  assert.equal(getOccurrenceStatus(task, "2026-08-10", completions)?.status, "done");
  assert.equal(getOccurrenceStatus(task, "2026-08-11", completions)?.status, "skipped");
  assert.equal(getOccurrenceStatus(task, "2026-08-12", completions), undefined);
});
