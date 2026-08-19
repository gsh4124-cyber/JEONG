import type { Project } from "./types";

export const normalizeProject = (value: Project): Project => {
  const { targetEndDate, startDate, dueDate, completedAt, ...project } = value;
  return {
    ...project,
    ...(startDate ? { startDate } : {}),
    ...(dueDate || targetEndDate ? { dueDate: dueDate || targetEndDate } : {}),
    ...(completedAt ? { completedAt } : {}),
  };
};

export const withProjectStatus = (project: Project, status: Project["status"], now = new Date().toISOString()): Project => ({
  ...project,
  status,
  completedAt: status === "done" ? project.completedAt ?? now : undefined,
});

/** Calendar-day difference: D-0 means the target date is today. */
export const getProjectDday = (dueDate?: string, today = new Date()): number | undefined => {
  if (!dueDate) return undefined;
  const [year, month, day] = dueDate.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return undefined;
  const target = Date.UTC(year, month - 1, day);
  const current = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target - current) / 86_400_000);
};

export const formatProjectPeriod = (project: Project) => {
  const start = project.startDate?.replaceAll("-", ".");
  const due = project.dueDate?.replaceAll("-", ".");
  if (start && due) return `${start} — ${due}`;
  if (due) return `~ ${due}`;
  if (start) return `${start} —`;
  return "기간 미정";
};
