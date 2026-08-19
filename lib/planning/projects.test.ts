import assert from "node:assert/strict";
import test from "node:test";
import { getProjectDday, normalizeProject, withProjectStatus } from "./projects";
import type { Project } from "./types";

const project: Project = { id: "p", name: "Project", goal: "", next: "", status: "active", milestones: [], note: "" };

test("project dates remain optional for legacy projects", () => {
  assert.deepEqual(normalizeProject(project), project);
});
test("completion date is set on completion and cleared when reopened", () => {
  const done = withProjectStatus(project, "done", "2026-08-11T00:00:00.000Z");
  assert.equal(done.completedAt, "2026-08-11T00:00:00.000Z");
  assert.equal(withProjectStatus(done, "active").completedAt, undefined);
});
test("D-day uses local calendar days", () => {
  assert.equal(getProjectDday("2026-08-12", new Date(2026, 7, 11)), 1);
  assert.equal(getProjectDday("2026-08-11", new Date(2026, 7, 11)), 0);
});

test("legacy target end dates migrate to dueDate without inventing a date", () => {
  assert.deepEqual(normalizeProject({ ...project, targetEndDate: "2026-12-31" }), { ...project, dueDate: "2026-12-31" });
  assert.deepEqual(normalizeProject(project), project);
});
